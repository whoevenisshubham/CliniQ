import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/demo-auth";

const ROLE_ROUTES: Record<string, string[]> = {
  "/doctor": ["doctor", "nurse"],
  "/patient": ["patient"],
  "/admin": ["admin"],
  "/research": ["research", "admin"],
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const user = raw ? decodeSession(raw) : null;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  for (const [route, allowed] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route)) {
      if (!allowed.includes(user.role)) {
        const url = request.nextUrl.clone();
        const rolePaths: Record<string, string> = {
          doctor: "/doctor", nurse: "/doctor",
          patient: "/patient", admin: "/admin", research: "/research",
        };
        url.pathname = rolePaths[user.role] ?? "/login";
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
