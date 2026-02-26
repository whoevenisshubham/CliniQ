import { cookies } from "next/headers";
import { decodeSession, SESSION_COOKIE } from "./demo-auth";
import type { UserRole } from "./types";

export async function getServerUser() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getServerUser();
  if (!user) return null;
  if (!allowedRoles.includes(user.role as UserRole)) return null;
  return user;
}

export function getRoleDashboardPath(role: UserRole): string {
  const paths: Record<UserRole, string> = {
    doctor: "/doctor",
    patient: "/patient",
    nurse: "/doctor",
    admin: "/admin",
    research: "/research",
  };
  return paths[role] ?? "/";
}
