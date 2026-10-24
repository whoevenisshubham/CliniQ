BEGIN;
ALTER TABLE public.patients ADD COLUMN account_revision integer NOT NULL DEFAULT 0 CHECK(account_revision>=0);
ALTER TABLE public.family_members ADD COLUMN archived_at timestamptz;
ALTER TABLE public.data_consents ADD COLUMN managed_preference boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX patient_managed_purpose ON public.data_consents(patient_id,purpose) WHERE managed_preference;
CREATE TABLE public.patient_account_changes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),patient_id uuid NOT NULL REFERENCES public.patients(id),actor_id uuid NOT NULL REFERENCES public.users(id),
 revision integer NOT NULL,action text NOT NULL,before_value jsonb,after_value jsonb,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(patient_id,revision)
);
ALTER TABLE public.patient_account_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_account_changes FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.patient_account_changes TO service_role;
CREATE TRIGGER account_history_immutable BEFORE UPDATE OR DELETE ON public.patient_account_changes FOR EACH ROW EXECUTE FUNCTION private.immutable_approved();
CREATE FUNCTION private.check_family_parent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ancestor uuid:=NEW.parent_id;steps integer:=0;BEGIN
 PERFORM 1 FROM public.patients WHERE id=NEW.patient_id FOR UPDATE;
 WHILE ancestor IS NOT NULL LOOP
 IF ancestor=NEW.id OR steps>=16 THEN RAISE EXCEPTION 'FAMILY_CYCLE_OR_DEPTH';END IF;
 SELECT parent_id INTO ancestor FROM public.family_members WHERE id=ancestor AND patient_id=NEW.patient_id AND archived_at IS NULL;IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_PARENT';END IF;steps:=steps+1;
 END LOOP;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.check_family_parent() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER family_parent_boundary BEFORE INSERT OR UPDATE OF parent_id,patient_id ON public.family_members FOR EACH ROW EXECUTE FUNCTION private.check_family_parent();

CREATE FUNCTION private.account_text(v jsonb,minimum integer,maximum integer) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_typeof(v)='string' AND length(btrim(v#>>'{}')) BETWEEN minimum AND maximum,false)
$$;
CREATE FUNCTION private.account_terms(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 RETURN jsonb_array_length(v)<=20 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v) x WHERE NOT private.account_text(x,1,120));
END $$;
REVOKE ALL ON FUNCTION private.account_text(jsonb,integer,integer),private.account_terms(jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.patient_account_view() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();p public.patients;profile jsonb;family jsonb;preferences jsonb;measurements jsonb;BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=a AND role='patient') THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO p FROM public.patients WHERE user_id=a;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT jsonb_build_object('name',p.name,'phone',p.phone,'dob',p.dob,'gender',p.gender,'bloodGroup',p.blood_group,'address',p.address,'emergencyContact',p.emergency_contact,'allergies',p.allergies,'conditions',p.chronic_conditions,'language',u.language_pref) INTO profile FROM public.users u WHERE id=a;
 SELECT coalesce(jsonb_agg(x),'[]') INTO family FROM(SELECT id,name,relation,age,gender,conditions,deceased,parent_id,archived_at FROM public.family_members WHERE patient_id=p.id ORDER BY created_at,id LIMIT 100) x;
 SELECT coalesce(jsonb_agg(x),'[]') INTO preferences FROM(SELECT id,purpose,enabled,updated_at,managed_preference FROM public.data_consents WHERE patient_id=p.id ORDER BY updated_at DESC,id LIMIT 100) x;
 SELECT coalesce(jsonb_agg(x),'[]') INTO measurements FROM(SELECT v.id source_version,v.reviewed_at,NOT EXISTS(SELECT 1 FROM public.emr_versions n WHERE n.amended_from_id=v.id) current_source,m.ordinality ordinal,m.value measurement FROM public.emr_versions v JOIN public.consultations c ON c.id=v.consultation_id CROSS JOIN LATERAL jsonb_array_elements(v.snapshot->'vitals') WITH ORDINALITY m WHERE c.patient_id=p.id ORDER BY v.reviewed_at DESC,v.id,m.ordinality LIMIT 200) x;
 RETURN jsonb_build_object('revision',p.account_revision,'profile',profile,'family',family,'preferences',preferences,'measurements',measurements);
END $$;

CREATE FUNCTION public.patient_account_mutate(k uuid,command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=private.current_app_user_id();p public.patients;prior public.care_operations;action text:=command->>'action';d jsonb;before_value jsonb;after_value jsonb;f public.family_members;node public.family_members;parent uuid;ancestor uuid;steps integer;response jsonb;BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 PERFORM 1 FROM public.users WHERE id=a AND role='patient' AND is_active FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF k IS NULL OR jsonb_typeof(command) IS DISTINCT FROM 'object' OR octet_length(command::text)>16384 THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('care-actor:'||a::text,0));
 SELECT * INTO p FROM public.patients WHERE user_id=a FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT * INTO prior FROM public.care_operations WHERE actor_id=a AND operation_key=k;
 IF FOUND THEN IF prior.command<>command THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN prior.response;END IF;
 IF p.account_revision IS DISTINCT FROM (command->>'expectedRevision')::integer THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 IF (SELECT count(*) FROM public.care_operations WHERE actor_id=a AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'OPERATION_LIMIT';END IF;
 IF action='profile' THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(command) x WHERE x<>ALL(ARRAY['action','expectedRevision','profile'])) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 d:=command->'profile';IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(d))<>10 OR EXISTS(SELECT 1 FROM jsonb_object_keys(d) x WHERE x<>ALL(ARRAY['name','phone','dob','gender','bloodGroup','address','emergencyContact','allergies','conditions','language'])) THEN RAISE EXCEPTION 'INVALID_PROFILE';END IF;
 IF NOT private.account_text(d->'name',1,120) OR NOT private.account_text(d->'phone',0,40) OR NOT private.account_text(d->'address',0,1000) OR NOT private.account_text(d->'emergencyContact',0,500) OR NOT private.account_text(d->'bloodGroup',0,10) OR NOT private.account_terms(d->'allergies') OR NOT private.account_terms(d->'conditions') OR d->>'language' IS NULL OR d->>'language'<>ALL(ARRAY['en','hi','hinglish']) THEN RAISE EXCEPTION 'INVALID_PROFILE';END IF;
 IF d->'dob'<>'null'::jsonb AND (NOT private.account_text(d->'dob',10,10) OR d->>'dob'!~'^\d{4}-\d{2}-\d{2}$' OR (d->>'dob')::date NOT BETWEEN current_date-interval '130 years' AND current_date) THEN RAISE EXCEPTION 'INVALID_PROFILE';END IF;
 IF d->'gender'<>'null'::jsonb AND (d->>'gender' IS NULL OR d->>'gender'<>ALL(ARRAY['M','F','Other'])) THEN RAISE EXCEPTION 'INVALID_PROFILE';END IF;
 IF d->>'bloodGroup'<>ALL(ARRAY['','A+','A-','B+','B-','AB+','AB-','O+','O-']) THEN RAISE EXCEPTION 'INVALID_PROFILE';END IF;
 before_value:=to_jsonb(p)||jsonb_build_object('language',(SELECT language_pref FROM public.users WHERE id=a));
 UPDATE public.patients SET name=btrim(d->>'name'),phone=d->>'phone',dob=(d->>'dob')::date,gender=d->>'gender',blood_group=nullif(d->>'bloodGroup',''),address=nullif(d->>'address',''),emergency_contact=nullif(d->>'emergencyContact',''),allergies=ARRAY(SELECT jsonb_array_elements_text(d->'allergies')),chronic_conditions=ARRAY(SELECT jsonb_array_elements_text(d->'conditions')) WHERE id=p.id;
 UPDATE public.users SET name=btrim(d->>'name'),language_pref=d->>'language' WHERE id=a;
 after_value:=d;
 ELSIF action='preference' THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(command) x WHERE x<>ALL(ARRAY['action','expectedRevision','purpose','enabled'])) OR command->>'purpose' IS NULL OR command->>'purpose'<>ALL(ARRAY['research','public_health','insurance','whatsapp']) OR jsonb_typeof(command->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 SELECT to_jsonb(x) INTO before_value FROM public.data_consents x WHERE patient_id=p.id AND purpose=command->>'purpose' AND managed_preference;
 INSERT INTO public.data_consents(patient_id,purpose,enabled,managed_preference) VALUES(p.id,command->>'purpose',(command->>'enabled')::boolean,true) ON CONFLICT(patient_id,purpose) WHERE managed_preference DO UPDATE SET enabled=excluded.enabled,updated_at=now() RETURNING to_jsonb(data_consents) INTO after_value;
 ELSIF action='family' THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(command) x WHERE x<>ALL(ARRAY['action','expectedRevision','memberId','member'])) THEN RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 d:=command->'member';IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(d))<>8 OR EXISTS(SELECT 1 FROM jsonb_object_keys(d) x WHERE x<>ALL(ARRAY['name','relation','age','gender','conditions','deceased','parentId','archived'])) OR NOT private.account_text(d->'name',1,120) OR NOT private.account_text(d->'relation',1,60) OR NOT private.account_terms(d->'conditions') OR jsonb_typeof(d->'deceased') IS DISTINCT FROM 'boolean' OR jsonb_typeof(d->'archived') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_FAMILY';END IF;
 IF d->'age'<>'null'::jsonb AND (jsonb_typeof(d->'age') IS DISTINCT FROM 'number' OR (d->>'age')!~'^\d{1,3}$' OR (d->>'age')::integer NOT BETWEEN 0 AND 130) THEN RAISE EXCEPTION 'INVALID_FAMILY';END IF;
 IF d->'gender'<>'null'::jsonb AND (d->>'gender' IS NULL OR d->>'gender'<>ALL(ARRAY['M','F'])) THEN RAISE EXCEPTION 'INVALID_FAMILY';END IF;
 IF command->'memberId' IS DISTINCT FROM 'null'::jsonb THEN SELECT * INTO f FROM public.family_members WHERE id=(command->>'memberId')::uuid AND patient_id=p.id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;before_value:=to_jsonb(f);
 ELSE IF (SELECT count(*) FROM public.family_members WHERE patient_id=p.id)>=100 THEN RAISE EXCEPTION 'FAMILY_LIMIT';END IF;f.id:=gen_random_uuid();END IF;
 parent:=(d->>'parentId')::uuid;ancestor:=parent;steps:=0;
 WHILE ancestor IS NOT NULL LOOP
 IF ancestor=f.id OR steps>=16 THEN RAISE EXCEPTION 'FAMILY_CYCLE_OR_DEPTH';END IF;
 SELECT parent_id INTO ancestor FROM public.family_members WHERE id=ancestor AND patient_id=p.id AND archived_at IS NULL;IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_PARENT';END IF;steps:=steps+1;
 END LOOP;
 IF (d->>'archived')::boolean AND EXISTS(SELECT 1 FROM public.family_members WHERE parent_id=f.id AND archived_at IS NULL) THEN RAISE EXCEPTION 'FAMILY_HAS_CHILDREN';END IF;
 IF before_value IS NULL THEN INSERT INTO public.family_members(id,patient_id,name,relation) VALUES(f.id,p.id,btrim(d->>'name'),btrim(d->>'relation'));END IF;
 UPDATE public.family_members SET name=btrim(d->>'name'),relation=btrim(d->>'relation'),age=(d->>'age')::integer,gender=d->>'gender',conditions=ARRAY(SELECT jsonb_array_elements_text(d->'conditions')),deceased=(d->>'deceased')::boolean,parent_id=parent,archived_at=CASE WHEN (d->>'archived')::boolean THEN coalesce(archived_at,now()) ELSE NULL END WHERE id=f.id RETURNING to_jsonb(family_members) INTO after_value;
 FOR node IN SELECT * FROM public.family_members WHERE patient_id=p.id AND archived_at IS NULL LOOP
 ancestor:=node.parent_id;steps:=0;
 WHILE ancestor IS NOT NULL LOOP
 IF ancestor=node.id OR steps>=16 THEN RAISE EXCEPTION 'FAMILY_CYCLE_OR_DEPTH';END IF;
 SELECT parent_id INTO ancestor FROM public.family_members WHERE id=ancestor AND patient_id=p.id AND archived_at IS NULL;IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_PARENT';END IF;steps:=steps+1;
 END LOOP;END LOOP;
 ELSE RAISE EXCEPTION 'INVALID_COMMAND';END IF;
 UPDATE public.patients SET account_revision=account_revision+1 WHERE id=p.id RETURNING account_revision INTO p.account_revision;
 INSERT INTO public.patient_account_changes(patient_id,actor_id,revision,action,before_value,after_value) VALUES(p.id,a,p.account_revision,action,before_value,after_value);
 response:=jsonb_build_object('revision',p.account_revision,'memberId',CASE WHEN action='family' THEN f.id ELSE NULL END);
 INSERT INTO public.care_operations(actor_id,operation_key,command,response) VALUES(a,k,command,response);RETURN response;
END $$;
REVOKE ALL ON FUNCTION public.patient_account_view(),public.patient_account_mutate(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.patient_account_view(),public.patient_account_mutate(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
