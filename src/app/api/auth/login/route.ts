import { NextRequest, NextResponse } from "next/server";
import { findUser, encodeSession, SESSION_COOKIE } from "@/lib/demo-auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const user = findUser(email, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const session = encodeSession(user);
    const res = NextResponse.json({ ok: true, user });

    res.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
