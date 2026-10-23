import "server-only";
import { requirePrincipal } from "./auth/context";
import { errorResponse, HttpError, requireSameOrigin } from "./http";

// Preserve existing implementations for focused repair. No environment flag
// reopens an unscoped route. Replace each wrapper only after negative tests pass.
export function containLegacyRoute(implementation: unknown) {
  void implementation;
  return async function contained(request: Request) {
    try {
      await requirePrincipal();
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) requireSameOrigin(request);
      throw new HttpError(503, "WORKFLOW_NOT_READY", "This workflow is temporarily unavailable while access controls are upgraded.");
    } catch (error) { return errorResponse(error); }
  };
}
