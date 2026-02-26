import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET() {
    const supabase = getSupabaseAdminClient();

    try {
        // Total consultations
        const { count: totalConsultations } = await supabase
            .from("consultations")
            .select("*", { count: "exact", head: true });

        // Today's consultations
        const today = new Date().toISOString().split("T")[0];
        const { count: todayConsultations } = await supabase
            .from("consultations")
            .select("*", { count: "exact", head: true })
            .gte("started_at", today);

        // Active consultations
        const { count: activeConsultations } = await supabase
            .from("consultations")
            .select("*", { count: "exact", head: true })
            .eq("status", "active");

        // Total revenue
        const { data: billingData } = await supabase
            .from("billing_drafts")
            .select("total");
        const totalRevenue = (billingData ?? []).reduce(
            (sum: number, b: { total: number }) => sum + (b.total ?? 0), 0
        );

        // Consultations by month (last 6 months)
        const { data: allConsultations } = await supabase
            .from("consultations")
            .select("started_at, status")
            .gte("started_at", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());

        const monthlyData: Record<string, number> = {};
        (allConsultations ?? []).forEach((c: { started_at: string }) => {
            const month = new Date(c.started_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
            monthlyData[month] = (monthlyData[month] ?? 0) + 1;
        });

        // Top diagnoses from EMR
        const { data: emrData } = await supabase
            .from("emr_entries")
            .select("diagnosis");
        const diagCounts: Record<string, number> = {};
        (emrData ?? []).forEach((e: { diagnosis: string[] }) => {
            (e.diagnosis ?? []).forEach((d: string) => {
                diagCounts[d] = (diagCounts[d] ?? 0) + 1;
            });
        });
        const topDiagnoses = Object.entries(diagCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        // Doctor performance
        const { data: doctors } = await supabase
            .from("users")
            .select("id, name, department")
            .eq("role", "doctor");

        const doctorPerf = await Promise.all(
            (doctors ?? []).map(async (doc: { id: string; name: string; department: string }) => {
                const { count } = await supabase
                    .from("consultations")
                    .select("*", { count: "exact", head: true })
                    .eq("doctor_id", doc.id);
                return {
                    name: doc.name,
                    department: doc.department,
                    consultations: count ?? 0,
                };
            })
        );

        return NextResponse.json({
            stats: {
                total_consultations: totalConsultations ?? 0,
                today_consultations: todayConsultations ?? 0,
                active_consultations: activeConsultations ?? 0,
                total_revenue: totalRevenue,
            },
            monthly_volume: Object.entries(monthlyData).map(([month, count]) => ({ month, count })),
            top_diagnoses: topDiagnoses,
            doctor_performance: doctorPerf,
        });
    } catch (err) {
        console.error("[Admin API] analytics error:", err);
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}
