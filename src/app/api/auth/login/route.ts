import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { errorResponse, HttpError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "INVALID_CREDENTIALS", "Enter your email and password.");
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some(key => !["email", "password"].includes(key)) ||
        typeof input.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254 ||
        typeof input.password !== "string" || input.password.length < 1 || input.password.length > 1024) {
      throw new HttpError(400, "INVALID_CREDENTIALS", "Enter your email and password.");
    }
    const client = await getSupabaseServerClient();
    const { error } = await client.auth.signInWithPassword({ email: input.email, password: input.password });
    if (error) throw new HttpError(401, "LOGIN_FAILED", "Sign-in failed. Check your credentials and try again.");
    try {
      const user = await resolvePrincipal(client);
      return privateJson({ data: { user }, meta: { requestId: crypto.randomUUID() } });
    } catch (error) {
      await client.auth.signOut({ scope: "local" });
      throw error;
    }
  } catch (error) { return errorResponse(error); }
}
