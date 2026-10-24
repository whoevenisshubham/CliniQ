import { requirePrincipal } from "@/lib/server/auth/context";
import { errorResponse, privateJson } from "@/lib/server/http";

export async function GET() {
  try { return privateJson({ data: await requirePrincipal(),meta:{requestId:crypto.randomUUID()} }); }
  catch(error) { return errorResponse(error); }
}
