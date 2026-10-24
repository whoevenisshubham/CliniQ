"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { readJsonResponse } from "@/lib/client/http-response";
import {
  DocumentList,
  RecordLayout,
  SourceDetail,
  AddRecordButton,
  type DocumentRow,
  type SourceChunk,
} from "./DocumentSurface";

type Version = {
  id: string;
  version_no: number;
  extraction_status: string;
  mime: string;
  source_class: string;
};
type Grant = { id: string; provider_id: string; workspace_id: string };
export type Detail = {
  document: DocumentRow;
  versions: Version[];
  chunks: SourceChunk[];
  grants: Grant[];
};
export type Provider = {
  provider_id: string;
  workspace_id: string;
  name: string;
  workspace_name: string;
};
async function serverApi(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(45000),
  });
  return readJsonResponse(response);
}
export function DocumentWorkspace({
  provider = false,
  fixture,
  initialDocumentId = null,
}: {
  provider?: boolean;
  fixture?: { rows: DocumentRow[]; detail: Detail; providers: Provider[] };
  initialDocumentId?: string | null;
}) {
  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!fixture) return serverApi(path, init);
      if (init?.method)
        throw new Error(
          "Visual sample only: changes are not saved. Use a provisioned account for the real workflow.",
        );
      if (path === "/api/documents") return { documents: fixture.rows };
      if (path === "/api/documents/providers")
        return { providers: fixture.providers };
      return fixture.detail;
    },
    [fixture],
  );

  const [rows, setRows] = useState<DocumentRow[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [selected, setSelected] = useState<string | null>(initialDocumentId),
    [selectionEpoch,setSelectionEpoch]=useState(0),
    [providers, setProviders] = useState<Provider[]>([]),
    [mode, setMode] = useState<
      "upload" | "replace" | "manual" | "share" | "delete" | null
    >(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [uncertain,setUncertain]=useState(false),[accessLost,setAccessLost]=useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [dialogError, setDialogError] = useState(""),
    [title, setTitle] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [text, setText] = useState("");
  const retry = useRef<{ signature: string; key: string } | null>(null),
    headingRef = useRef<HTMLDivElement>(null),live=useRef(true),selectionRef=useRef<string|null>(initialDocumentId);
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  type PendingRequest={url:string;headers:Record<string,string>;body:FormData|string;kind:'upload'|'change';action?:string};
  const pendingRequest=useRef<PendingRequest|null>(null),mutationLock=useRef(false);
  const hideAccessFailure=useCallback((e:unknown)=>{if(![401,403,404].includes((e as{status?:number}).status??0))return;setAccessLost(true);setRows([]);setDetail(null);setProviders([]);selectionRef.current=null;setSelected(null);setMode(null);setFile(null);setText('');setTitle('');pendingRequest.current=null;setUncertain(false);},[]);
  async function refresh(target = selected) {
    const list = await api("/api/documents");
    if(!live.current)return;
    setRows(list.documents);
    if (target) {
      try {
        const data = await api("/api/documents/" + target);
        if(live.current&&selectionRef.current===target)setDetail(data);
      } catch (e) {
        hideAccessFailure(e);
        if(!live.current||selectionRef.current!==target)throw e;
        setDetail(null);
        selectionRef.current=null;setSelected(null);
        throw e;
      }
    }
  }
  useEffect(()=>{if(!detail)return;const hash=window.location.hash;const chunk=detail.chunks.find(c=>hash==="#source-"+c.id);if(chunk)document.getElementById("source-"+chunk.id)?.focus();},[detail]);
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    api("/api/documents", { signal: c.signal })
      .then((data) => {
        if (active) setRows(data.documents);
      })
      .catch((e) => {
        if (active){hideAccessFailure(e);setError(e.message);}
      })
      .finally(() => {
        if (active) setLoading(false);
      });
  return () => {
      active = false;
      c.abort();
    };
  }, [api,hideAccessFailure]);
  // Bounded polling; after one minute the user can continue later or refresh.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    async function poll() {
      if (cancelled||!live.current) return;
      if (document.hidden) {
        timer = setTimeout(poll, 5000);
        return;
      }
      try {
        const d: Detail = await api("/api/documents/" + selected);
        if (cancelled||!live.current) return;
        if(selectionRef.current!==selected)return;
        setDetail(d);
        setLoading(false);
        const version = d.versions.find(
          (v) => v.id === d.document.current_version_id,
        );
        if (
          version &&
          ["queued", "parsing"].includes(version.extraction_status) &&
          Date.now() - started < 60000
        )
          timer = setTimeout(
            poll,
            Date.now() - started < 10000
              ? 2000
              : Date.now() - started < 30000
                ? 5000
                : 10000,
          );
      } catch (e) {
        if (!cancelled&&live.current&&selectionRef.current===selected) {
          hideAccessFailure(e);
          setLoading(false);
          setDetail(null);
          selectionRef.current=null;setSelected(null);
          setError((e as Error).message);
        }
      }
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selected, api,selectionEpoch,hideAccessFailure]);
  useEffect(() => {
    if (!selected || mode !== null) return;
    let active=true;
    const recheck = () => {
      if (document.hidden||!live.current) return;
      setDetail(null);setLoading(true);
      api("/api/documents/" + selected)
        .then(d=>{if(active&&live.current&&selectionRef.current===selected)setDetail(d);})
        .catch(e=>{if(active&&live.current&&selectionRef.current===selected){hideAccessFailure(e);setLoading(false);selectionRef.current=null;setSelected(null);setError(e.message);}})
        .finally(()=>{if(active&&live.current&&selectionRef.current===selected)setLoading(false);});
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      active=false;
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [selected, mode, api,hideAccessFailure]);
  async function choose(id: string) {
    if(mutationLock.current||pendingRequest.current)return;
    selectionRef.current=id;setSelectionEpoch(n=>n+1);setError("");setDetail(null);setSelected(id);setLoading(true);
    // The selected-document effect owns fetching/polling, preventing duplicate
    // competing requests from painting another document after a fast selection.
    headingRef.current?.focus();
  }
  const dialogOpener = useRef<HTMLElement | null>(null);
  function open(next: typeof mode) {
    if(mutationLock.current||pendingRequest.current){setError("Reconcile the saved request before starting another action.");return;}
    dialogOpener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setMode(next);
    setTitle(next === "upload" ? "" : (detail?.document.title ?? ""));
    setFile(null);
    setText("");
    setDialogError("");
    retry.current = null;
    if (next === "share")
      void api("/api/documents/providers")
        .then((d) => {if(live.current)setProviders(d.providers);})
        .catch((e) => {if(live.current){hideAccessFailure(e);setDialogError(e.message);}});
  }
  async function submitPending(){
    const op=pendingRequest.current;if(!op||mutationLock.current)return;
    mutationLock.current=true;setBusy(true);setDialogError('');
    let result;
    try{result=await api(op.url,{method:'POST',headers:op.headers,body:op.body});}
    catch(e){if(live.current){const status=(e as{status?:number}).status;if(status&&status<500){pendingRequest.current=null;setUncertain(false);}else if(!fixture)setUncertain(true);else pendingRequest.current=null;hideAccessFailure(e);setDialogError((e as Error).message);setError((e as Error).message);}return;}
    finally{mutationLock.current=false;if(live.current)setBusy(false);}
    pendingRequest.current=null;if(!live.current)return;setUncertain(false);
    if(op.kind==='upload'){
      retry.current=null;setMode(null);setNotice('Original bytes and metadata are saved. Text processing is queued; you can return later.');
      try{await refresh(null);await choose(result.document_id);}catch(e){hideAccessFailure(e);setError('Saved; the refreshed view is unavailable. '+(e as Error).message);}
    }else{
      if(op.action==='delete'){selectionRef.current=null;setSelected(null);setDetail(null);setMode(null);setNotice('Access is removed. Private byte cleanup is queued.');}
      else setNotice(op.action==='share'?'Explicit sharing saved.':op.action==='retry'?'Text processing queued again.':'Future access revoked. Previously downloaded copies cannot be recalled.');
      try{await refresh(op.action==='delete'?null:selected);}catch(e){hideAccessFailure(e);setError('Change saved; the refreshed view is unavailable. '+(e as Error).message);}
    }
  }
  async function upload(e:React.FormEvent){
    e.preventDefault();if(pendingRequest.current){await submitPending();return;}
    try{
      const chosen=mode==='manual'?new File([text],'manual-transcript.txt',{type:'text/plain'}):file;
      if(!chosen)throw new Error('Choose a file.');if(mode==='manual'&&!text.trim())throw new Error('Enter the transcript as you read it.');
      const signature=[title,chosen.name,chosen.size,mode==='manual'?text:chosen.lastModified,mode,selected].join('|');
      if(!retry.current||retry.current.signature!==signature)retry.current={signature,key:crypto.randomUUID()};
      const form=new FormData();form.set('title',title);form.set('file',chosen);
      if(mode!=='upload'){form.set('revision',String(detail!.document.revision));if(mode==='manual')form.set('parentVersionId',detail!.document.current_version_id!);}
      pendingRequest.current={kind:'upload',url:mode==='upload'?'/api/documents':`/api/documents/${selected}/versions`,headers:{'idempotency-key':retry.current.key},body:form};
      await submitPending();
    }catch(e){if(live.current)setDialogError((e as Error).message);}
  }
  async function change(action:string,p?:Provider|Grant){
    if(pendingRequest.current){setError('Reconcile the saved request before starting another action.');return;}
    pendingRequest.current={kind:'change',action,url:'/api/documents/'+selected,headers:{'content-type':'application/json'},body:JSON.stringify({key:crypto.randomUUID(),revision:detail!.document.revision,action,providerId:p?.provider_id,workspaceId:p?.workspace_id})};
    await submitPending();
  }
  const version = detail?.versions.find(
    (v) => v.id === detail.document.current_version_id,
  );
  if(accessLost)return <RecordLayout provider={provider}><h1>Access changed</h1><p>Private record details and local form contents have been hidden.</p><a href="/records">Reload your authorized library</a><p><a href="/login">Sign in again</a></p></RecordLayout>;
  return (
    <RecordLayout provider={provider} fixture={!!fixture}>
      {uncertain&&<p role="alert">Request outcome unconfirmed. Your original request and operation key are retained. <button className="quiet-button" disabled={busy} onClick={()=>void submitPending()}>Reconcile saved request</button></p>}
      <div tabIndex={-1} ref={headingRef} className="workspace-focus">
        {error && (
          <div role="alert" className="error-message">
            {error}
            <button
              className="quiet-button"
              onClick={() => {
                setError("");
                void refresh().catch((e) => setError(e.message));
              }}
            >
              Retry loading
            </button>
          </div>
        )}
        {notice && (
          <p className="status-message" role="status">
            {notice}
          </p>
        )}
        {loading ? (
          <p role="status">Loading your private records…</p>
        ) : detail ? (
          <>
            <SourceDetail
              title={detail.document.title}
              chunks={detail.chunks}
              status={version?.extraction_status ?? detail.document.status}
              version={version?.version_no ?? 1}
              sourceClass={version?.source_class}
              onBack={() => {
                if(busy||uncertain)return;
                selectionRef.current=null;setSelected(null);
                setDetail(null);
              }}
            >
              <div className="document-actions">
                {detail.document.status === "ready" && !fixture && (
                  <a
                    className="secondary-button"
                    href={`/api/documents/${selected}/content`}
                  >
                    Download original
                  </a>
                )}
                {!provider && (
                  <button
                    className="primary-button"
                    onClick={() => open("share")}
                  >
                    Manage sharing
                  </button>
                )}
              </div>
            </SourceDetail>
            <div className="document-actions">
              <button
                className="secondary-button"
                onClick={() => void refresh().catch((e) => setError(e.message))}
              >
                Refresh processing state
              </button>
              {!provider && (
                <>
                  {version?.extraction_status === "failed" && (
                    <button
                      className="secondary-button"
                      disabled={busy||uncertain}
                      onClick={() =>
                        void change("retry").catch((e) => setError(e.message))
                      }
                    >
                      Retry text processing
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    onClick={() => open("replace")}
                  >
                    Add replacement
                  </button>
                  {version && (
                    <button
                      className="secondary-button"
                      onClick={() => open("manual")}
                    >
                      Add manual transcript
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    onClick={() => open("delete")}
                  >
                    Delete record
                  </button>
                </>
              )}
            </div>
            {!provider && detail.versions.length > 1 && (
              <section className="version-history">
                <h2>Retained source versions</h2>
                <p>
                  Earlier sources are private to you. Replacement clears
                  sharing; share the new source explicitly.
                </p>
                {detail.versions.map((v) => (
                  <p key={v.id}>
                    <a
                      href={`/api/documents/${selected}/content?version=${v.id}`}
                    >
                      Version {v.version_no} ·{" "}
                      {v.source_class === "manual"
                        ? "Patient-entered transcript"
                        : "Original file"}
                    </a>
                    {v.id === detail.document.current_version_id
                      ? " · current"
                      : ""}
                  </p>
                ))}
              </section>
            )}
          </>
        ) : (
          <DocumentList
            rows={rows}
            provider={provider}
            onSelect={(id) => void choose(id)}
          >
            {!provider && <AddRecordButton onClick={() => open("upload")} />}
          </DocumentList>
        )}
      </div>
      <Dialog.Root
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setMode(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              dialogOpener.current?.focus();
            }}
            className="dialog-panel"
            onEscapeKeyDown={(e) => {
              if (busy) e.preventDefault();
            }}
            onPointerDownOutside={(e) => {
              if (busy) e.preventDefault();
            }}
          >
            <Dialog.Title>
              {mode === "share"
                ? "Choose who can read this record"
                : mode === "delete"
                  ? "Delete this record?"
                  : mode === "manual"
                    ? "Add your manual transcript"
                    : mode === "replace"
                      ? "Add a replacement version"
                      : "Add a private record"}
            </Dialog.Title>
            <Dialog.Description>
              {mode === "share"
                ? "Sharing applies only to this record and the selected clinician and workspace."
                : mode === "delete"
                  ? "This removes access immediately and queues permanent cleanup of its bytes and text. This action cannot be undone."
                  : mode === "manual"
                    ? "Enter what you can read, without guessing. This becomes a labelled patient-entered text version linked to the retained original. Add a separate text box for each page you enter. Compare it with the retained original."
                    : mode === "replace"
                      ? "The original stays in your private version history. Existing sharing is revoked; share the replacement explicitly."
                      : "PDF, UTF-8 text, PNG or JPEG. Up to 4 MiB each; 10 records and 40 MiB including retained versions. Scans may need manual text."}
            </Dialog.Description>
            {dialogError && (
              <p role="alert" className="error-message">
                {dialogError}
              </p>
            )}
            {["upload", "replace", "manual"].includes(mode ?? "") ? (
              <form onSubmit={upload} className="form-stack">
                <label>
                  Record title
                  <input
                    autoFocus
                    required
                    maxLength={160}
                    disabled={busy||uncertain}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                {mode === "manual" ? (
                  <>
                    {text.split("\f").map((page, index) => (
                      <label key={index}>
                        Patient-entered text · page {index + 1}
                        <textarea
                          required
                          maxLength={100000}
                          rows={6}
                          disabled={busy||uncertain}
                          value={page}
                          onChange={(e) => {
                            const pages = text.split("\f");
                            pages[index] = e.target.value;
                            const updated = pages.join("\f");
                            if (Array.from(updated).length <= 100000)
                              setText(updated);
                            else
                              setDialogError(
                                "Manual text is limited to 100,000 characters.",
                              );
                          }}
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy || uncertain || text.split("\f").length >= 20}
                      onClick={() => setText(text + "\f")}
                    >
                      Add next page
                    </button>
                  </>
                ) : (
                  <label>
                    File
                    <input
                      required
                      disabled={busy||uncertain}
                      type="file"
                      accept=".pdf,.txt,.png,.jpg,.jpeg"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
                <div className="document-actions">
                  <button className="primary-button" disabled={busy}>
                    {busy
                      ? "Saving…"
                      : fixture
                        ? "Visual sample · no save"
                        : uncertain?"Reconcile saved request":"Save private record"}
                  </button>
                  <button
                    type="button"
                    className="quiet-button"
                    disabled={busy||uncertain}
                    onClick={() => setMode(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : mode === "share" ? (
              <>
                <h3>Currently shared</h3>
                {detail?.grants.length ? (
                  detail.grants.map((g) => (
                    <div className="sharing-row" key={g.id}>
                      <span>
                        {providers.find(
                          (p) =>
                            p.provider_id === g.provider_id &&
                            p.workspace_id === g.workspace_id,
                        )?.name ?? "Previously authorized clinician"}
                      </span>
                      <button
                        className="secondary-button"
                        disabled={busy||uncertain}
                        onClick={() => void change("revoke", g)}
                      >
                        Revoke
                      </button>
                    </div>
                  ))
                ) : (
                  <p>Private · no active grants</p>
                )}
                <h3>Eligible care team</h3>
                {providers.length ? (
                  providers.map((p) => (
                    <div
                      className="sharing-row"
                      key={p.provider_id + p.workspace_id}
                    >
                      <span>
                        {p.name}
                        <br />
                        <small>{p.workspace_name}</small>
                      </span>
                      <button
                        disabled={
                          busy || uncertain ||
                          !!detail?.grants.find(
                            (g) =>
                              g.provider_id === p.provider_id &&
                              g.workspace_id === p.workspace_id,
                          )
                        }
                        className="primary-button"
                        onClick={() => void change("share", p)}
                      >
                        Share
                      </button>
                    </div>
                  ))
                ) : (
                  <p>
                    No eligible clinician is currently linked to your account.
                  </p>
                )}
                <button
                  className="quiet-button"
                  disabled={busy||uncertain}
                  onClick={() => setMode(null)}
                >
                  Done
                </button>
              </>
            ) : (
              <div className="document-actions">
                <button
                  className="primary-button"
                  disabled={busy||uncertain}
                  onClick={() => void change("delete")}
                >
                  {busy ? "Deleting…" : "Delete permanently"}
                </button>
                <button
                  className="quiet-button"
                  disabled={busy||uncertain}
                  onClick={() => setMode(null)}
                >
                  Keep record
                </button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </RecordLayout>
  );
}
