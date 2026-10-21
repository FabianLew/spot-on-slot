import { isReportKind } from "@/components/admin/admin-home";
import { ReportsScreen } from "@/components/admin/reports-screen";
import { navMetadata } from "@/lib/nav-metadata";

export default async function Page({ searchParams }: PageProps<"/admin/reports">) {
  const { kind } = await searchParams;
  return <ReportsScreen kind={typeof kind === "string" && isReportKind(kind) ? kind : undefined} />;
}

export const generateMetadata = () => navMetadata("adminReports");
