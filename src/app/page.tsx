import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getRoleDashboardPath } from "@/lib/auth";

export default async function HomePage() {
  const user = await getServerUser();

  if (user) {
    redirect(getRoleDashboardPath(user.role));
  }

  redirect("/login");
}
