"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { type DocumentRow } from "@/components/documents/DocumentSurface";
import {
  DocumentWorkspace,
  type Detail,
} from "@/components/documents/DocumentWorkspace";
const rows: DocumentRow[] = [
  {
    id: "visual-one",
    title: "Visit notes · annual review",
    status: "ready",
    revision: 1,
    current_version_id: "visual-version",
    created_at: "2026-10-21T12:00:00Z",
  },
  {
    id: "visual-two",
    title: "Discharge instructions",
    status: "ready",
    revision: 1,
    current_version_id: "visual-version",
    created_at: "2026-10-18T12:00:00Z",
  },
  {
    id: "visual-three",
    title: "Scanned referral letter",
    status: "ready",
    revision: 1,
    current_version_id: "visual-version",
    created_at: "2026-10-12T12:00:00Z",
  },
];
const detail: Detail = {
  document: rows[0],
  versions: [
    {
      id: "visual-version",
      version_no: 1,
      mime: "text/plain",
      extraction_status: "text_ready",
      source_class: "original",
    },
  ],
  chunks: [
    {
      id: "visual-source",
      page: 1,
      ordinal: 0,
      offset_start: 0,
      offset_end: 253,
      text: "Synthetic source for layout review\n\nVisit notes · annual review\n\nThis is an illustrative document passage, not a patient record or medical advice.\n\nBring the original record to your next appointment. Discuss any questions with your clinician.",
    },
  ],
  grants: [],
};
const normalFixture = {
  rows,
  detail,
  providers: [
    {
      provider_id: "visual-provider",
      workspace_id: "visual-workspace",
      name: "Dr. Rao · synthetic clinician",
      workspace_name: "Sample care workspace",
    },
  ],
};
const emptyFixture = { ...normalFixture, rows: [] };
function Surface() {
  const q = useSearchParams();
  return (
    <DocumentWorkspace
      key={q.toString()}
      provider={q.get("view") === "provider"}
      fixture={q.get("state") === "empty" ? emptyFixture : normalFixture}
      initialDocumentId={q.get("view") === "detail" ? "visual-one" : null}
    />
  );
}
export function VisualDocuments() {
  return (
    <Suspense fallback={<p>Loading visual fixture…</p>}>
      <Surface />
    </Suspense>
  );
}
