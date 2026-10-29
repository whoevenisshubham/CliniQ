import { errorResponse, HttpError } from "@/lib/server/http";

function unavailable() {
  return errorResponse(new HttpError(410, "ENDPOINT_REMOVED", "Hosted provisioning is unavailable."));
}

export const GET = unavailable;
export const POST = unavailable;
