import { expect,it } from 'vitest';
import { readJsonResponse,accessDenied } from '@/lib/client/http-response';
import {careResponse,continuityResponse,billingResponse,accountResponse,clinicalResponse,evidenceResponse,speechResponse,documentResponse} from '@/lib/client/workspace-response';
import {emptySnapshot} from '@/lib/contracts/clinical';

// Response/privacy contracts only. These do not exercise scheduling behavior.
const cases = [
  {name:'care',check:careResponse,view:{slots:[],appointments:[],patients:[],providers:[],queue:[]},saved:{appointmentId:'saved-appointment',revision:0}},
  {name:'continuity',check:continuityResponse,view:{role:'patient',prescriptions:[],schedules:[],tasks:[],adherence:[],approvedVersions:[]},saved:{taskId:'saved-task',revision:0,processing:'pending'}},
  {name:'billing',check:billingResponse,view:{canReview:false,revision:null,bill:null,tariffs:[],approvedVersions:[],history:[]},saved:{billId:'saved-bill',revision:1,totalPaise:30000,illustrative:true,taxStatus:'not_assessed'}},
  {name:'account',check:accountResponse,view:{revision:0,profile:{name:'Synthetic',language:'en',phone:null,dob:null,gender:null,bloodGroup:null,address:null,emergencyContact:null,allergies:null,conditions:[]},family:[],preferences:[],measurements:[]},saved:{revision:1,memberId:null}},
];

for (const c of cases) {
  it(`${c.name}: validates the expected saved and view envelopes`,async()=>{
    expect(c.check({data:c.view})).toBe(true);
    await expect(readJsonResponse(Response.json({data:c.saved}),b=>c.check(b,true))).resolves.toEqual({data:c.saved});
    for(const body of [null,[],{}, {data:null},{data:{}},{data:{...c.saved,revision:'1'}}]){
      const error=await readJsonResponse(Response.json(body),b=>c.check(b,true)).catch(e=>e);
      expect(error).toBeInstanceOf(Error);expect(error).not.toHaveProperty('status');
    }
  });
  it(`${c.name}: retains definitive access loss even with unreadable/null bodies`,async()=>{
    for(const status of [401,403,404])for(const raw of ['', '<html>private diagnostic</html>', 'null','{']){
      const error=await readJsonResponse(new Response(raw,{status}),b=>c.check(b)).catch(e=>e);
      expect(error.status).toBe(status);expect(accessDenied(error)).toBe(true);expect(error.message).not.toContain('private diagnostic');
    }
  });
}

it('rejects invalid nested rows before a view can replace private state',()=>{
 expect(careResponse({data:{...cases[0].view,queue:[null]}})).toBe(false);
 expect(continuityResponse({data:{...cases[1].view,tasks:[{id:'task',kind:'follow_up',due_at:'invalid',revision:0,display_time_zone:'UTC'}]}})).toBe(false);
 expect(billingResponse({data:{...cases[2].view,tariffs:[{version:'synthetic',effectiveOn:'2026-10-24',items:null}]}})).toBe(false);
 expect(accountResponse({data:{...cases[3].view,family:[{id:'relative',name:null}]}})).toBe(false);
});

it('clinical contracts preserve absent operation lookup and nullable approved/amended content',()=>{
 expect(clinicalResponse({data:null},'/api/clinical/operations/synthetic-key')).toBe(true);
 expect(clinicalResponse({data:null},'/api/clinical',true)).toBe(false);
 const approved={id:'version-two',consultation_id:'encounter-one',reviewed_at:'2026-10-24T04:00:00Z',source_revision:2,amended_from_id:'version-one',snapshot:emptySnapshot()};
 expect(clinicalResponse({data:{role:'patient',approved:[approved]}},'/api/clinical')).toBe(true);
 expect(clinicalResponse({data:{role:'doctor',visits:[],patients:[],care:[]}},'/api/clinical')).toBe(true);
 expect(clinicalResponse({data:{role:'patient',approved:[{...approved,snapshot:{...approved.snapshot,medications:null}}]}},'/api/clinical')).toBe(false);
});

it('evidence contracts accept truthful unavailable/evidence-only/rejected and structured saved results',()=>{
 for(const state of ['unavailable','rejected','outcome_unknown','stale','cancelled'])expect(evidenceResponse({data:{id:'job-one',state,result:null,sources:[]}},'/api/jobs/job-one')).toBe(true);
 const result={schemaVersion:'1',answerKind:'insufficient_evidence',answer:'No supported answer.',facts:[],definitions:[],uncertainties:[],citedSourceIds:[]};
 expect(evidenceResponse({data:{id:'job-one',state:'succeeded',result,sources:[]}},'/api/jobs/job-one')).toBe(true);
 expect(evidenceResponse({data:{id:'job-one',state:'succeeded',result:{...result,facts:null},sources:[]}},'/api/jobs/job-one')).toBe(false);
});

it('speech and document contracts reject invented successful states and preserve nullable current versions',()=>{
 expect(speechResponse({data:{available:false,mode:'disabled'}},'availability')).toBe(true);
 expect(speechResponse({data:{state:'saved',operationId:'op-one'}},'save')).toBe(false);
 expect(speechResponse({data:{id:'op-one',status:'outcome_unknown'}},'status')).toBe(true);
 expect(documentResponse({documents:[{id:'doc-one',title:'Synthetic',status:'uploading',revision:0,current_version_id:null}]},'/api/documents')).toBe(true);
 expect(documentResponse({document_id:'doc-one'},'/api/documents',true)).toBe(false);
});
