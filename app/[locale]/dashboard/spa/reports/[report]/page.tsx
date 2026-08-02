import { notFound } from "next/navigation";
import SpaReportWorkspace from "@/components/spa/SpaReportWorkspace";
import { getSpaReport } from "@/lib/spa-modules";

export default async function SpaReportPage({
  params,
}: {
  params: Promise<{ report: string }>;
}) {
  const { report } = await params;
  const definition = getSpaReport(report);
  if (!definition) notFound();

  return <SpaReportWorkspace definition={definition} />;
}
