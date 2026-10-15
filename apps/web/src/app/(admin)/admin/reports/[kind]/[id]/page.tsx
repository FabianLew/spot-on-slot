import { notFound } from "next/navigation";
import { ReportTargetScreen } from "@/components/admin/report-target-screen";
import { isReportKind } from "@/components/admin/admin-home";
import { navMetadata } from "@/lib/nav-metadata";

export default async function Page({ params }: PageProps<"/admin/reports/[kind]/[id]">) {
  const { kind, id } = await params;
  if (!isReportKind(kind)) notFound();
  return <ReportTargetScreen kind={kind} targetId={id} />;
}

export const generateMetadata = () => navMetadata("adminReports");
