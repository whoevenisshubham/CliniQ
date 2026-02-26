import type { UserRole } from "./types";

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  department?: string;
}

export const DEMO_USERS: Array<DemoUser & { password: string }> = [
  {
    id: "demo-doctor-001",
    email: "demo.doctor@nexusmd.app",
    password: "demo123456",
    name: "Dr. Arjun Sharma",
    role: "doctor",
    department: "Internal Medicine",
  },
  {
    id: "demo-patient-001",
    email: "demo.patient@nexusmd.app",
    password: "demo123456",
    name: "Priya Sharma",
    role: "patient",
  },
  {
    id: "demo-admin-001",
    email: "demo.admin@nexusmd.app",
    password: "demo123456",
    name: "Admin User",
    role: "admin",
  },
  {
    id: "demo-nurse-001",
    email: "demo.nurse@nexusmd.app",
    password: "demo123456",
    name: "Nurse Kavita",
    role: "nurse",
    department: "General Ward",
  },
  {
    id: "demo-research-001",
    email: "demo.research@nexusmd.app",
    password: "demo123456",
    name: "Dr. Meera Nair",
    role: "research",
    department: "Clinical Research",
  },
];

export const SESSION_COOKIE = "nexusmd_session";

export function findUser(email: string, password: string): DemoUser | null {
  const found = DEMO_USERS.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === password
  );
  if (!found) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...user } = found;
  return user;
}

export function encodeSession(user: DemoUser): string {
  return Buffer.from(JSON.stringify(user)).toString("base64");
}

export function decodeSession(value: string): DemoUser | null {
  try {
    return JSON.parse(
      Buffer.from(value, "base64").toString("utf8")
    ) as DemoUser;
  } catch {
    return null;
  }
}