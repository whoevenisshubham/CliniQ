import { redirect } from "next/navigation";
import { requirePrincipal } from "@/lib/server/auth/context";

export default async function SafetyAlertsPage() {
  const user = await requirePrincipal().catch(()=>null);
  if (!user) redirect("/login");
  if(user.role==='nurse')redirect('/staff');
  if(user.role!=='doctor')redirect('/login');
  redirect('/consultations');
}
