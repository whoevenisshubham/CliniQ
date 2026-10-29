import "server-only";
import { requirePrincipal } from "./server/auth/context";
import type { UserRole } from "./types";

export async function getServerUser() {
  try { return await requirePrincipal(); }
  catch { return null; }
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
    nurse: "/staff",
    admin: "/admin",
    research: "/research",
    receptionist: "/receptionist",
  };
  return paths[role] ?? "/";
}
