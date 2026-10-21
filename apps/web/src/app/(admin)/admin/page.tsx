import { redirect } from "next/navigation";
import { ADMIN_HOME } from "@/components/admin/admin-home";

export default function Page() {
  redirect(ADMIN_HOME);
}
