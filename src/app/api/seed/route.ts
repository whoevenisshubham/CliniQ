import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uses service role key — server only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DEMO_USERS = [
  {
    email: "demo.doctor@nexusmd.app",
    password: "demo123456",
    name: "Dr. Arjun Sharma",
    role: "doctor",
    phone: "+91-9876543210",
    language_pref: "en",
  },
  {
    email: "demo.patient@nexusmd.app",
    password: "demo123456",
    name: "Priya Sharma",
    role: "patient",
    phone: "+91-9876543211",
    language_pref: "hi",
  },
  {
    email: "demo.admin@nexusmd.app",
    password: "demo123456",
    name: "Admin User",
    role: "admin",
    phone: "+91-9876543212",
    language_pref: "en",
  },
  {
    email: "demo.nurse@nexusmd.app",
    password: "demo123456",
    name: "Nurse Kavita",
    role: "nurse",
    phone: "+91-9876543213",
    language_pref: "en",
  },
  {
    email: "demo.research@nexusmd.app",
    password: "demo123456",
    name: "Dr. Meera Nair",
    role: "research",
    phone: "+91-9876543214",
    language_pref: "en",
  },
];

export async function POST() {
  const results: { email: string; status: string; error?: string }[] = [];

  // Step 1: Ensure the users table exists by checking schema
  const { error: tableCheckError } = await supabaseAdmin
    .from("users")
    .select("id")
    .limit(1);

  if (tableCheckError && tableCheckError.code === "42P01") {
    // Table doesn't exist — need to run migration first
    return NextResponse.json(
      {
        success: false,
        error: "Database tables not found. Please run the SQL migration first.",
        migration_path: "supabase/migrations/001_nexusmd_schema.sql",
        supabase_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/project/default/sql`,
      },
      { status: 500 }
    );
  }

  // Step 2: Create each demo user
  for (const demo of DEMO_USERS) {
    try {
      // Check if user already exists
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const alreadyExists = existing?.users?.find((u) => u.email === demo.email);

      let userId: string;

      if (alreadyExists) {
        // Update password in case it changed
        await supabaseAdmin.auth.admin.updateUserById(alreadyExists.id, {
          password: demo.password,
          email_confirm: true,
        });
        userId = alreadyExists.id;
        results.push({ email: demo.email, status: "updated" });
      } else {
        // Create new auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: demo.email,
          password: demo.password,
          email_confirm: true, // auto-confirm — no email verify needed for demo
        });

        if (authError || !authUser.user) {
          results.push({ email: demo.email, status: "error", error: authError?.message });
          continue;
        }

        userId = authUser.user.id;
        results.push({ email: demo.email, status: "created" });
      }

      // Upsert profile into our users table
      const { error: profileError } = await supabaseAdmin
        .from("users")
        .upsert(
          {
            id: userId,
            email: demo.email,
            name: demo.name,
            role: demo.role,
            phone: demo.phone,
            language_pref: demo.language_pref,
          },
          { onConflict: "id" }
        );

      if (profileError) {
        results.push({ email: demo.email, status: "profile_error", error: profileError.message });
      }

      // Create a patient record for the demo patient
      if (demo.role === "patient") {
        await supabaseAdmin.from("patients").upsert(
          {
            user_id: userId,
            name: demo.name,
            dob: "1981-03-15",
            gender: "F",
            blood_group: "B+",
            allergies: ["Penicillin", "Sulfa drugs"],
            chronic_conditions: ["Type 2 Diabetes", "Hypertension"],
            abha_id: "DEMO-ABHA-12345",
            phone: demo.phone,
          },
          { onConflict: "user_id" }
        );
      }
    } catch (err) {
      results.push({
        email: demo.email,
        status: "exception",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const allOk = results.every((r) => ["created", "updated"].includes(r.status));

  return NextResponse.json({
    success: allOk,
    message: allOk
      ? "Demo users ready! You can now sign in."
      : "Some users had issues — check results.",
    results,
    credentials: {
      doctor: { email: "demo.doctor@nexusmd.app", password: "demo123456" },
      patient: { email: "demo.patient@nexusmd.app", password: "demo123456" },
      admin: { email: "demo.admin@nexusmd.app", password: "demo123456" },
    },
  });
}

export async function GET() {
  // Quick health check — tells client if tables exist and users are seeded
  const { error: tableError } = await supabaseAdmin
    .from("users")
    .select("id")
    .limit(1);

  if (tableError?.code === "42P01") {
    return NextResponse.json({ ready: false, reason: "migration_needed" });
  }

  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const demoExists = existing?.users?.some((u) => u.email === "demo.doctor@nexusmd.app");

  return NextResponse.json({
    ready: demoExists,
    reason: demoExists ? "ok" : "seed_needed",
    table_ok: !tableError,
  });
}
