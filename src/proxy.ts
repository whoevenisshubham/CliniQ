import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRoleDashboardPath } from "@/lib/auth";
import { resolvePrincipal } from "@/lib/server/auth/context";
import { getSupabaseConfiguration } from "@/lib/supabase-server";

const ROLE_ROUTES: Record<string, string[]> = {
  "/doctor": ["doctor", "nurse"], "/patient": ["patient"],
  "/admin": ["admin"], "/research": ["research"], "/receptionist": ["receptionist"],
};

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  try {
    const { url, key } = getSupabaseConfiguration();
    const client = createServerClient(url, key, { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    } });
    const user = await resolvePrincipal(client);
    const route = Object.keys(ROLE_ROUTES).find(path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/"));
    if (route && !ROLE_ROUTES[route].includes(user.role)) {
      const redirect = NextResponse.redirect(new URL(getRoleDashboardPath(user.role), request.url));
      response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
      response = redirect;
    }
  } catch {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    response = redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

// Explicit protected prefixes include extension-bearing URLs and reception.
// APIs enforce their own admission and never depend on this redirect layer.
export const config = { matcher: ["/doctor/:path*", "/patient/:path*", "/admin/:path*", "/research/:path*", "/receptionist/:path*"] };
