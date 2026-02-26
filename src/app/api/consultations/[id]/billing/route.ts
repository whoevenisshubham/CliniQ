import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

// POST — Save billing draft for a consultation
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: consultationId } = await params;
        const body = await request.json();

        const supabase = getSupabaseAdminClient();

        // Try billing_drafts first, then billing_records
        const billingData = {
            consultation_id: consultationId,
            line_items: body.line_items ?? [],
            subtotal: body.subtotal ?? 0,
            tax: body.tax ?? 0,
            total: body.total ?? 0,
            status: body.status ?? "draft",
            created_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from("billing_records")
            .insert(billingData)
            .select()
            .single();

        if (error) {
            // Try alternate table name
            const { data: d2, error: e2 } = await supabase
                .from("billing_drafts")
                .insert(billingData)
                .select()
                .single();
            if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
            return NextResponse.json({ billing: d2 });
        }

        return NextResponse.json({ billing: data });
    } catch {
        return NextResponse.json({ error: "Failed to save billing" }, { status: 500 });
    }
}
