import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
    const supabase = getSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");

    try {
        let query = supabase
            .from("users")
            .select("*")
            .order("created_at", { ascending: false });

        if (role) query = query.eq("role", role);

        const { data, error } = await query;

        if (error) {
            console.error("[Admin API] users error:", error);
            return NextResponse.json({ users: [], error: error.message });
        }

        return NextResponse.json({ users: data ?? [] });
    } catch (err) {
        console.error("[Admin API] users error:", err);
        return NextResponse.json({ users: [], error: "Failed to fetch" });
    }
}

export async function POST(request: Request) {
    const supabase = getSupabaseAdminClient();

    try {
        const body = await request.json();
        const { email, name, role, phone, department } = body;

        if (!email || !name || !role) {
            return NextResponse.json({ error: "email, name, role are required" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("users")
            .insert({ email, name, role, phone, department })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ user: data });
    } catch (err) {
        console.error("[Admin API] user create error:", err);
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
}
