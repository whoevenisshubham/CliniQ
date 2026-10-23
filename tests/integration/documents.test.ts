import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import {
  localConfiguration,
  root,
  sql,
} from "../../scripts/local-supabase.mjs";
import { GET as list, POST as upload } from "@/app/api/documents/route";
import { GET as detail, POST as change } from "@/app/api/documents/[id]/route";
import { GET as bytesRoute } from "@/app/api/documents/[id]/content/route";
import { POST as replace } from "@/app/api/documents/[id]/versions/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { runDocumentJob, reconcileDocuments } from "@/lib/server/jobs/runner";
import { uploadDocument } from "@/lib/server/documents/service";
import { validateFile } from "@/lib/server/documents/validation";
import { parseDocument } from "@/lib/server/documents/parser";
import { jsPDF } from "jspdf";
const state = vi.hoisted(() => ({
  jar: null as {
    getAll: () => { name: string; value: string }[];
    set: (n: string, v: string) => void;
    delete: (n: string) => void;
  } | null,
}));
vi.mock("next/headers", () => ({ cookies: async () => state.jar }));
const config = localConfiguration(),
  fixture = JSON.parse(
    readFileSync(root + "/tests/infra/.runtime/fixture.json", "utf8"),
  ),
  { actors, ids } = fixture;
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const clients: Record<string, SupabaseClient> = {},
  jars: Record<string, NonNullable<typeof state.jar>> = {};
const payload = new TextEncoder().encode(
  "Synthetic record — first page.\nSource reference preserved.\fSecond synthetic page.",
);
let documentId = "",
  versionId = "",
  revision = 0;
const origin = "http://localhost:3000";
const ctx = (id = documentId) => ({ params: Promise.resolve({ id }) });
function as(name: string) {
  state.jar = jars[name];
}
function request(action: string, body?: unknown) {
  return new Request(origin + "/api/documents/" + documentId, {
    method: action,
    headers: { origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
function formRequest(
  fileBytes = payload,
  options: {
    key?: string;
    title?: string;
    mime?: string;
    name?: string;
    revision?: number;
    parent?: string;
  } = {},
) {
  const form = new FormData();
  form.set("title", options.title ?? "Synthetic persisted source");
  form.set(
    "file",
    new File([fileBytes], options.name ?? "source.txt", {
      type: options.mime ?? "text/plain",
    }),
  );
  if (options.revision !== undefined)
    form.set("revision", String(options.revision));
  if (options.parent) form.set("parentVersionId", options.parent);
  return new Request(origin + "/api/documents", {
    method: "POST",
    headers: { origin, "idempotency-key": options.key ?? randomUUID() },
    body: form,
  });
}
async function data() {
  const r = await detail(request("GET"), ctx());
  expect(r.status).toBe(200);
  return r.json();
}
async function mutation(action: string, extra: Record<string, unknown> = {}) {
  return change(
    request("POST", { key: randomUUID(), action, revision, ...extra }),
    ctx(),
  );
}
async function noRows(
  client: SupabaseClient,
  table: string,
  field: string,
  id: string,
) {
  const r = await client.from(table).select("*").eq(field, id);
  expect(r.error, JSON.stringify(r.error)).toBeNull();
  expect(r.data).toEqual([]);
}
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", config.API_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", config.ANON_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", config.SERVICE_ROLE_KEY);
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("DOCUMENT_DISPATCH_SECRET", "");
  const inventory = await admin.auth.admin.listUsers({ page: 1, perPage: 51 });
  expect(inventory.error).toBeNull();
  if (inventory.data.users.length > 48)
    throw new Error(
      "Isolated synthetic Auth cap reached; preserve this stack and use fresh CI",
    );
  // Explicit, bounded test provisioning: two new patients; M1 identities/history remain untouched.
  for (const suffix of ["A", "B"]) {
    const email = `m2.${suffix}.${randomUUID()}@synthetic.example.test`,
      password = randomUUID() + randomUUID(),
      appId = randomUUID(),
      patientId = randomUUID();
    const auth = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });
    expect(auth.error).toBeNull();
    expect(
      (
        await admin.from("users").insert({
          id: appId,
          auth_user_id: auth.data.user!.id,
          email,
          name: "Synthetic M2 Patient " + suffix,
          role: "patient",
          is_active: true,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await admin.from("patients").insert({
          id: patientId,
          user_id: appId,
          name: "Synthetic M2 Patient " + suffix,
        })
      ).error,
    ).toBeNull();
    actors["patient" + suffix] = {
      ...actors["patient" + suffix],
      email,
      password,
      authId: auth.data.user!.id,
      appId,
    };
    ids["patient" + suffix] = patientId;
    expect(
      (
        await admin.from("care_relationships").insert({
          patient_id: patientId,
          provider_id: actors["doctor" + suffix].appId,
          workspace_id: ids["workspace" + suffix],
          scope: "clinical",
          granted_by: appId,
        })
      ).error,
    ).toBeNull();
  }
  writeFileSync(
    root + "/tests/infra/.runtime/m2-journey.json",
    JSON.stringify({
      actors: { patientA: actors.patientA, patientB: actors.patientB },
      ids,
      scope: "isolated synthetic only",
    }),
  );

  for (const name of [
    "patientA",
    "patientB",
    "doctorA",
    "doctorB",
    "doctorU",
    "reception",
    "admin",
  ]) {
    const values = new Map<string, string>(),
      jar = {
        getAll: () => Array.from(values, ([name, value]) => ({ name, value })),
        set: (n: string, v: string) => {
          values.set(n, v);
        },
        delete: (n: string) => {
          values.delete(n);
        },
      };
    const client = createServerClient(config.API_URL, config.ANON_KEY, {
      cookies: {
        getAll: jar.getAll,
        setAll: (items) =>
          items.forEach(({ name, value }) => jar.set(name, value)),
      },
    });
    expect(
      (
        await client.auth.signInWithPassword({
          email: actors[name].email,
          password: actors[name].password,
        })
      ).error,
    ).toBeNull();
    clients[name] = client;
    jars[name] = jar;
  }
});
afterAll(async () => {
  const removed = await admin
    .from("care_relationships")
    .delete()
    .in("patient_id", [ids.patientA, ids.patientB]);
  expect(removed.error).toBeNull();
  vi.unstubAllEnvs();
});
it("actual multipart route persists bytes and metadata; same-key retries do not duplicate or charge again", async () => {
  as("patientA");
  const key = randomUUID();
  const response = await upload(formRequest(payload, { key }));
  expect(await response.clone().json()).not.toHaveProperty("error");
  expect(response.status).toBe(201);
  const result = await response.json();
  documentId = result.document_id;
  versionId = result.version_id;
  const retry = await upload(formRequest(payload, { key }));
  expect(retry.status).toBe(201);
  expect((await retry.json()).document_id).toBe(documentId);
  expect(
    (
      await admin
        .from("document_versions")
        .select("id")
        .eq("document_id", documentId)
    ).data,
  ).toHaveLength(1);
  const conflict = await upload(
    formRequest(new TextEncoder().encode("different"), { key }),
  );
  expect(conflict.status).toBe(409);
  const saved = await data();
  revision = saved.document.revision;
  expect(saved.versions[0].extraction_status).toBe("queued");
  expect((await bytesRoute(request("GET"), ctx())).status).toBe(200);
});
it("returning application session logs out, signs in, lists the same record and reads persisted private bytes", async () => {
  as("patientA");
  expect((await logout(request("POST"))).status).toBe(200);
  expect((await list()).status).toBe(401);
  expect(
    (
      await login(
        request("POST", {
          email: actors.patientA.email,
          password: actors.patientA.password,
        }),
      )
    ).status,
  ).toBe(200);
  clients.patientA = createServerClient(config.API_URL, config.ANON_KEY, {
    cookies: {
      getAll: jars.patientA.getAll,
      setAll: (items) =>
        items.forEach(({ name, value }) => jars.patientA.set(name, value)),
    },
  });
  const listed = await list();
  expect(listed.status).toBe(200);
  expect(
    (await listed.json()).documents.some(
      (d: { id: string }) => d.id === documentId,
    ),
  ).toBe(true);
  expect(await (await bytesRoute(request("GET"), ctx())).text()).toBe(
    new TextDecoder().decode(payload),
  );
});
it("actual parser job publishes bounded page-linked chunks; care-only and cross-owner reads are denied", async () => {
  const r = await admin
    .from("document_jobs")
    .select("id")
    .eq("document_id", documentId)
    .eq("status", "queued")
    .single();
  expect(r.error).toBeNull();
  expect((await runDocumentJob(admin, r.data!.id)).status).toBe("text_ready");
  as("patientA");
  const saved = await data();
  expect(saved.chunks.map((c: { page: number }) => c.page)).toEqual([1, 2]);
  expect(saved.chunks[0].offset_start).toBe(0);
  for (const name of [
    "patientB",
    "doctorA",
    "doctorB",
    "doctorU",
    "reception",
    "admin",
  ]) {
    as(name);
    expect((await detail(request("GET"), ctx())).status).toBe(404);
    expect((await bytesRoute(request("GET"), ctx())).status).toBe(404);
    await noRows(clients[name], "document_chunks", "document_id", documentId);
  }
});
it("explicit share enables provider reads; cross-workspace and self-assigned shares fail", async () => {
  as("patientA");
  expect(
    (
      await mutation("share", {
        providerId: actors.doctorB.appId,
        workspaceId: ids.workspaceB,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await mutation("share", {
        providerId: actors.doctorU.appId,
        workspaceId: ids.workspaceA,
      })
    ).status,
  ).toBe(403);
  const shared = await mutation("share", {
    providerId: actors.doctorA.appId,
    workspaceId: ids.workspaceA,
  });
  expect(shared.status).toBe(200);
  revision = (await shared.json()).revision;
  as("doctorA");
  expect((await detail(request("GET"), ctx())).status).toBe(200);
  expect((await bytesRoute(request("GET"), ctx())).status).toBe(200);
  expect(
    (
      await mutation("share", {
        providerId: actors.doctorA.appId,
        workspaceId: ids.workspaceA,
      })
    ).status,
  ).toBe(403);
});
it("revocation invalidates chunks/results, cancels running work and blocks stale publication and future bytes", async () => {
  const j = await admin.rpc("document_claim", {
    p_id: (
      await admin
        .from("document_jobs")
        .select("id")
        .eq("document_id", documentId)
        .eq("input_revision", revision)
        .eq("status", "queued")
        .single()
    ).data!.id,
  });
  expect(j.error).toBeNull();
  const job = j.data[0];
  expect(job.document_id).toBe(documentId);
  expect(
    (
      await admin.from("document_results").insert({
        document_id: documentId,
        input_revision: revision,
        status: "current",
      })
    ).error,
  ).toBeNull();
  as("patientA");
  const revoked = await mutation("revoke", {
    providerId: actors.doctorA.appId,
    workspaceId: ids.workspaceA,
  });
  expect(revoked.status).toBe(200);
  revision = (await revoked.json()).revision;
  const published = await admin.rpc("document_publish", {
    p_job: job.id,
    p_fence: job.fence,
    p_status: "text_ready",
    p_pages: 1,
    p_chunks: [
      {
        ordinal: 0,
        page: 1,
        text: "stale",
        offset_start: 0,
        offset_end: 5,
        text_sha256: "x",
      },
    ],
  });
  expect(published.error).toBeNull();
  expect(published.data).toBe(false);
  expect(
    (
      await admin
        .from("document_results")
        .select("status")
        .eq("document_id", documentId)
    ).data,
  ).toEqual([{ status: "stale" }]);
  as("doctorA");
  expect((await bytesRoute(request("GET"), ctx())).status).toBe(404);
  await noRows(clients.doctorA, "document_chunks", "document_id", documentId);
});
it("replacement retains owner original, revokes grants and invalidates an old job; manual text has provenance", async () => {
  as("patientA");
  const shared = await mutation("share", {
    providerId: actors.doctorA.appId,
    workspaceId: ids.workspaceA,
  });
  expect(shared.status).toBe(200);
  revision = (await shared.json()).revision;
  const claimed = await admin.rpc("document_claim", {
    p_id: (
      await admin
        .from("document_jobs")
        .select("id")
        .eq("document_id", documentId)
        .eq("input_revision", revision)
        .eq("status", "queued")
        .single()
    ).data!.id,
  });
  expect(claimed.error).toBeNull();
  const old = claimed.data[0];
  const response = await replace(
    formRequest(new TextEncoder().encode("Replacement source"), { revision }),
    ctx(),
  );
  expect(response.status).toBe(201);
  const newVersion = (await response.json()).version_id;
  expect(newVersion).not.toBe(versionId);
  const saved = await data();
  revision = saved.document.revision;
  expect(saved.versions).toHaveLength(2);
  expect(saved.grants).toHaveLength(0);
  expect(
    await (
      await bytesRoute(
        new Request(
          origin + `/api/documents/${documentId}/content?version=${versionId}`,
        ),
        ctx(),
      )
    ).text(),
  ).toBe(new TextDecoder().decode(payload));
  const stale = await admin.rpc("document_publish", {
    p_job: old.id,
    p_fence: old.fence,
    p_status: "empty",
    p_pages: 1,
    p_chunks: [],
  });
  expect(stale.error).toBeNull();
  expect(stale.data).toBe(false);
  as("doctorA");
  expect((await bytesRoute(request("GET"), ctx())).status).toBe(404);
  as("patientA");
  const manual = await replace(
    formRequest(
      new TextEncoder().encode(
        "Patient entered transcription.\fPage two typed by patient.",
      ),
      { name: "manual.txt", revision, parent: newVersion },
    ),
    ctx(),
  );
  expect(manual.status).toBe(201);
  const m = await data();
  revision = m.document.revision;
  expect(m.versions[0].source_class).toBe("manual");
  expect(m.versions[0].parent_version_id).toBe(newVersion);
});
it("cross-owner mutations, direct metadata writes, direct upload and commit/publish RPCs are denied", async () => {
  as("patientB");
  expect((await mutation("delete")).status).toBe(404);
  for (const c of [clients.patientA, clients.patientB, clients.doctorA]) {
    expect(
      (await c.rpc("document_commit", { p_operation: randomUUID() })).error
        ?.code,
    ).toBe("42501");
    expect((await c.rpc("document_claim", { p_id: null })).error?.code).toBe(
      "42501",
    );
    expect(
      (await c.from("document_versions").insert({ document_id: documentId }))
        .error?.code,
    ).toBe("42501");
    expect(
      (await c.storage.from("clinical-documents").upload("arbitrary", payload))
        .error,
    ).not.toBeNull();
  }
});
it("deletion immediately blocks bytes and chunks, stale workers cannot resurrect, purge removes retained bytes", async () => {
  as("patientA");
  const job = (
    await admin.rpc("document_claim", {
      p_id: (
        await admin
          .from("document_jobs")
          .select("id")
          .eq("document_id", documentId)
          .eq("input_revision", revision)
          .eq("status", "queued")
          .single()
      ).data!.id,
    })
  ).data[0];
  const retainedKeys = (
    await admin
      .from("document_versions")
      .select("object_key")
      .eq("document_id", documentId)
  ).data!;
  const deleted = await mutation("delete");
  expect(deleted.status).toBe(200);
  const republish = await admin.rpc("document_publish", {
    p_job: job.id,
    p_fence: job.fence,
    p_status: "empty",
    p_pages: 1,
    p_chunks: [],
  });
  expect(republish.error).toBeNull();
  expect(republish.data).toBe(false);
  expect((await bytesRoute(request("GET"), ctx())).status).toBe(404);
  await noRows(clients.patientA, "document_chunks", "document_id", documentId);
  const purge = (
    await admin
      .from("document_jobs")
      .select("id")
      .eq("document_id", documentId)
      .eq("kind", "purge_document")
      .single()
  ).data!;
  expect((await runDocumentJob(admin, purge.id)).status).toBe("succeeded");
  const originalOperation = (
    await admin
      .from("upload_operations")
      .select("operation_key")
      .eq("version_id", versionId)
      .single()
  ).data!;
  expect(
    (
      await upload(
        formRequest(payload, { key: originalOperation.operation_key }),
      )
    ).status,
  ).toBe(404);

  for (const v of retainedKeys)
    expect(
      (await admin.storage.from("clinical-documents").download(v.object_key))
        .error,
    ).not.toBeNull();
  expect(
    (
      await admin
        .from("document_versions")
        .select("id")
        .eq("document_id", documentId)
    ).data,
  ).toEqual([]);
});
it("missing MIME, executable/text mismatches, invalid UTF-8, empty and oversized bytes fail admission", () => {
  for (const [bytes, mime, name] of [
    [new Uint8Array(), "text/plain", "a.txt"],
    [new TextEncoder().encode("<html>bad"), "text/plain", "a.txt"],
    [new Uint8Array([255, 254]), "text/plain", "a.txt"],
    [payload, "application/pdf", "a.pdf"],
    [payload, "text/plain", "../a.txt"],
    [new Uint8Array(4194305), "text/plain", "big.txt"],
  ] as [Uint8Array, string, string][])
    expect(() => validateFile(bytes, mime, name)).toThrow();
});
it("bounded PDF parser extracts pages; encrypted, scanned, empty and oversized-page inputs are truthful", async () => {
  const pdf = new jsPDF();
  pdf.text("Synthetic PDF source", 20, 20);
  pdf.addPage();
  pdf.text("Second page", 20, 20);
  const parsed = await parseDocument(
    new Uint8Array(pdf.output("arraybuffer")),
    "application/pdf",
  );
  expect(parsed.status).toBe("text_ready");
  expect(parsed.chunks.map((c) => c.page)).toEqual([1, 2]);
  const scan = new jsPDF();
  expect(
    (
      await parseDocument(
        new Uint8Array(scan.output("arraybuffer")),
        "application/pdf",
      )
    ).status,
  ).toBe("needs_transcription");
  expect(
    (await parseDocument(new TextEncoder().encode("  \n"), "text/plain"))
      .status,
  ).toBe("empty");
  const encrypted = new jsPDF({
    encryption: {
      userPassword: "synthetic-password",
      ownerPassword: "synthetic-owner",
      userPermissions: ["print"],
    },
  });
  encrypted.text("Private synthetic", 20, 20);
  expect(
    (
      await parseDocument(
        new Uint8Array(encrypted.output("arraybuffer")),
        "application/pdf",
      )
    ).status,
  ).toBe("encrypted");
  for (let n = 2; n <= 21; n++) scan.addPage();
  expect(
    (
      await parseDocument(
        new Uint8Array(scan.output("arraybuffer")),
        "application/pdf",
      )
    ).status,
  ).toBe("unsupported");
  expect(
    (await parseDocument(new Uint8Array([137, 80, 78, 71]), "image/png"))
      .status,
  ).toBe("needs_transcription");
});
it("lost upload/failed commit is recovered only by exact operation key; no sweep or fabricated success", async () => {
  const key = randomUUID(),
    hash = createHash("sha256").update(payload).digest("hex");
  const admission = await clients.patientA.rpc("document_admit", {
    p_key: key,
    p_title: "Interrupted synthetic",
    p_name: "source.txt",
    p_mime: "text/plain",
    p_size: payload.length,
    p_hash: hash,
  });
  expect(admission.error).toBeNull();
  const op = admission.data;
  expect(
    (await admin.rpc("document_commit", { p_operation: op.id })).error?.message,
  ).toContain("BYTES_MISSING");
  expect(
    (
      await admin.storage
        .from("clinical-documents")
        .upload(op.object_key, payload, { contentType: "text/plain" })
    ).error,
  ).toBeNull();
  sql(
    `update public.upload_operations set expires_at=now()-interval '1 second' where id='${op.id}'`,
  );
  expect(
    (await admin.rpc("document_commit", { p_operation: op.id })).error?.message,
  ).toContain("UPLOAD_EXPIRED");
  expect((await reconcileDocuments(admin)).cleaned).toBeGreaterThan(0);
  expect(
    (await admin.storage.from("clinical-documents").download(op.object_key))
      .error,
  ).not.toBeNull();
  expect(
    (
      await admin
        .from("documents")
        .select("status")
        .eq("id", op.document_id)
        .single()
    ).data?.status,
  ).toBe("upload_failed");
  // Late completion after cleanup: retained operation tombstone re-cleans the exact key.
  expect(
    (
      await admin.storage
        .from("clinical-documents")
        .upload(op.object_key, payload, { contentType: "text/plain" })
    ).error,
  ).toBeNull();
  sql(
    `update public.upload_operations set cleaned_at=now()-interval '16 minutes' where id='${op.id}'`,
  );
  await reconcileDocuments(admin);
  expect(
    (await admin.storage.from("clinical-documents").download(op.object_key))
      .error,
  ).not.toBeNull();
});
it("expired lease is reclaimed with a new fence; stale or expired claim cannot publish", async () => {
  const result = await uploadDocument(clients.patientA, admin, {
    key: randomUUID(),
    title: "Lease synthetic",
    fileName: "a.txt",
    mime: "text/plain",
    bytes: payload,
  });
  const job = (
    await admin
      .from("document_jobs")
      .select("id")
      .eq("document_id", result.document_id)
      .single()
  ).data!;
  const first = (await admin.rpc("document_claim", { p_id: job.id })).data[0];
  sql(
    `update public.document_jobs set lease_until=now()-interval '1 second' where id='${job.id}'`,
  );
  const second = (await admin.rpc("document_claim", { p_id: job.id })).data[0];
  expect(second.fence).toBe(first.fence + 1);
  expect(
    (
      await admin.rpc("document_publish", {
        p_job: job.id,
        p_fence: first.fence,
        p_status: "empty",
        p_pages: 1,
        p_chunks: [],
      })
    ).data,
  ).toBe(false);
  expect(
    (
      await admin.rpc("document_publish", {
        p_job: job.id,
        p_fence: second.fence,
        p_status: "empty",
        p_pages: 1,
        p_chunks: [],
      })
    ).data,
  ).toBe(true);
});
it("concurrent identical admission commits once; duplicate mutation responses preserve one revision", async () => {
  const input = {
    key: randomUUID(),
    title: "Concurrent synthetic",
    fileName: "same.txt",
    mime: "text/plain",
    bytes: new TextEncoder().encode("Concurrent source 😀"),
  };
  const results = await Promise.all([
    uploadDocument(clients.patientB, admin, input),
    uploadDocument(clients.patientB, admin, input),
  ]);
  expect(results[0].version_id).toBe(results[1].version_id);
  const did = results[0].document_id;
  const d = (
    await admin.from("documents").select("revision").eq("id", did).single()
  ).data!;
  const params = {
    p_document: did,
    p_revision: d.revision,
    p_key: randomUUID(),
    p_action: "delete",
  };
  const [a, b] = await Promise.all([
    clients.patientB.rpc("document_change", params),
    clients.patientB.rpc("document_change", params),
  ]);
  expect(a.error).toBeNull();
  expect(b.error).toBeNull();
  expect(a.data).toEqual(b.data);
  expect(
    (
      await admin
        .from("document_jobs")
        .select("id")
        .eq("document_id", did)
        .eq("kind", "purge_document")
    ).data,
  ).toHaveLength(1);
});
it("a definite SQL commit failure after real Storage upload retains intent and same-key retry recovers", async () => {
  const key = randomUUID();
  const badCommit = {
    storage: admin.storage,
    rpc: (name: string, args: Record<string, unknown>) =>
      admin.rpc(
        name,
        name === "document_commit" ? { p_operation: randomUUID() } : args,
      ),
  } as unknown as SupabaseClient;
  const input = {
    key,
    title: "Commit recovery synthetic",
    fileName: "retry.txt",
    mime: "text/plain",
    bytes: new TextEncoder().encode("Recoverable source"),
  };
  await expect(
    uploadDocument(clients.patientB, badCommit, input),
  ).rejects.toMatchObject({ status: 404 });
  const op = (
    await admin
      .from("upload_operations")
      .select("*")
      .eq("actor_id", actors.patientB.appId)
      .eq("operation_key", key)
      .single()
  ).data!;
  expect(op.state).toBe("stored");
  expect(
    (await admin.storage.from("clinical-documents").download(op.object_key))
      .error,
  ).toBeNull();
  expect(
    (await uploadDocument(clients.patientB, admin, input)).document_id,
  ).toBe(op.document_id);
  expect(
    (
      await admin
        .from("document_versions")
        .select("id")
        .eq("document_id", op.document_id)
    ).data,
  ).toHaveLength(1);
});
it("a real Storage bucket failure leaves upload uncommitted and retry recovers without quota duplication", async () => {
  const input = {
    key: randomUUID(),
    title: "Storage recovery synthetic",
    fileName: "retry.txt",
    mime: "text/plain",
    bytes: new TextEncoder().encode("Storage recovery"),
  };
  const badStorage = {
    storage: { from: () => admin.storage.from("missing-m2-test-bucket") },
    rpc: admin.rpc.bind(admin),
  } as unknown as SupabaseClient;
  await expect(
    uploadDocument(clients.patientB, badStorage, input),
  ).rejects.toMatchObject({ status: 503, code: "UPLOAD_INTERRUPTED" });
  const op = (
    await admin
      .from("upload_operations")
      .select("document_id,state")
      .eq("actor_id", actors.patientB.appId)
      .eq("operation_key", input.key)
      .single()
  ).data!;
  expect(op.state).toBe("reserved");
  expect(
    (
      await admin
        .from("documents")
        .select("status")
        .eq("id", op.document_id)
        .single()
    ).data?.status,
  ).toBe("upload_failed");
  expect(
    (await uploadDocument(clients.patientB, admin, input)).document_id,
  ).toBe(op.document_id);
});
it("database admission enforces stored-byte and document quotas, without mocked authorization", async () => {
  const patient = ids.patientB,
    actor = actors.patientB.appId;
  const created: string[] = [];
  const hash = createHash("sha256").update("quota").digest("hex");
  const admit = () =>
    clients.patientB.rpc("document_admit", {
      p_key: randomUUID(),
      p_title: "Quota boundary",
      p_name: "q.txt",
      p_mime: "text/plain",
      p_size: 1,
      p_hash: hash,
    });
  try {
    // Administrative size fixtures exercise SQL accounting; these are not uploaded-file evidence.
    const existing =
      (
        await admin
          .from("documents")
          .select("id")
          .eq("patient_id", patient)
          .neq("status", "deleted")
      ).data ?? [];
    const big = randomUUID();
    created.push(big);
    expect(
      (
        await admin.from("documents").insert({
          id: big,
          patient_id: patient,
          created_by: actor,
          title: "Synthetic quota accounting",
        })
      ).error,
    ).toBeNull();
    for (let i = 1; i <= 10; i++)
      expect(
        (
          await admin.from("document_versions").insert({
            document_id: big,
            version_no: i,
            object_key: `quota/${randomUUID()}`,
            mime: "text/plain",
            byte_size: 4194304,
            sha256: hash,
          })
        ).error,
      ).toBeNull();
    expect((await admit()).error?.message).toContain("BYTE_QUOTA");
    expect(
      (await admin.from("document_versions").delete().eq("document_id", big))
        .error,
    ).toBeNull();
    for (let i = existing.length + 1; i < 10; i++) {
      const id = randomUUID();
      created.push(id);
      expect(
        (
          await admin.from("documents").insert({
            id,
            patient_id: patient,
            created_by: actor,
            title: "Synthetic quota slot",
          })
        ).error,
      ).toBeNull();
    }
    expect((await admit()).error?.message).toContain("DOCUMENT_QUOTA");
  } finally {
    for (const id of created) {
      expect(
        (await admin.from("document_versions").delete().eq("document_id", id))
          .error,
      ).toBeNull();
      expect(
        (await admin.from("documents").delete().eq("id", id)).error,
      ).toBeNull();
    }
  }
});
it("multipart path rejects forged origin and unsupported content before reserving anything", async () => {
  as("patientA");
  const badOrigin = formRequest();
  const wrong = new Request(badOrigin, {
    headers: {
      ...Object.fromEntries(badOrigin.headers),
      origin: "https://attacker.invalid",
    },
  });
  expect((await upload(wrong)).status).toBe(403);
  expect(
    (
      await upload(
        formRequest(new TextEncoder().encode("<html>bad"), {
          name: "bad.txt",
          mime: "text/plain",
        }),
      )
    ).status,
  ).toBe(415);
});
it("Unicode source offsets use code points and remain valid through real publication", async () => {
  const p = await parseDocument(
    new TextEncoder().encode("Synthetic 😀\nHindi हिन्दी"),
    "text/plain",
  );
  expect(p.chunks[0].offset_end).toBe(Array.from(p.chunks[0].text).length);
  const input = {
    key: randomUUID(),
    title: "Unicode synthetic",
    fileName: "unicode.txt",
    mime: "text/plain",
    bytes: new TextEncoder().encode("Synthetic 😀\nHindi हिन्दी"),
  };
  const r = await uploadDocument(clients.patientB, admin, input);
  const job = (
    await admin
      .from("document_jobs")
      .select("id")
      .eq("document_id", r.document_id)
      .eq("status", "queued")
      .single()
  ).data!;
  expect((await runDocumentJob(admin, job.id)).status).toBe("text_ready");
});
it("bounded retry exhaustion is visible and an explicit owner retry queues a new fenced revision", async () => {
  const r = await uploadDocument(clients.patientB, admin, {
    key: randomUUID(),
    title: "Exhaustion synthetic",
    fileName: "retry.txt",
    mime: "text/plain",
    bytes: new TextEncoder().encode("Retry source"),
  });
  const job = (
    await admin
      .from("document_jobs")
      .select("id")
      .eq("document_id", r.document_id)
      .single()
  ).data!;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const claim = await admin.rpc("document_claim", { p_id: job.id });
    expect(claim.error).toBeNull();
    expect(claim.data[0].attempts).toBe(attempt);
    expect(
      (
        await admin.rpc("document_job_fail", {
          p_job: job.id,
          p_fence: claim.data[0].fence,
        })
      ).data,
    ).toBe(true);
    sql(
      `update public.document_jobs set available_at=now()-interval '1 second' where id='${job.id}'`,
    );
  }
  expect((await admin.rpc("document_claim", { p_id: job.id })).data).toEqual(
    [],
  );
  expect(
    (
      await admin
        .from("document_versions")
        .select("extraction_status")
        .eq("id", r.version_id)
        .single()
    ).data?.extraction_status,
  ).toBe("failed");
  const before = (
    await admin
      .from("documents")
      .select("revision")
      .eq("id", r.document_id)
      .single()
  ).data!;
  const retry = await clients.patientB.rpc("document_change", {
    p_document: r.document_id,
    p_revision: before.revision,
    p_key: randomUUID(),
    p_action: "retry",
  });
  expect(retry.error).toBeNull();
  expect(
    (
      await admin
        .from("document_jobs")
        .select("id")
        .eq("document_id", r.document_id)
        .eq("status", "queued")
    ).data,
  ).toHaveLength(1);
});
