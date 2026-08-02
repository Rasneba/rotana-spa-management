import SpaReportWorkspace from "@/components/spa/SpaReportWorkspace";
import { getSpaReport } from "@/lib/spa-modules";

export default function AccessReportsPage() {
  const definition = getSpaReport("access");
  if (!definition) return null;
  return <SpaReportWorkspace definition={definition} />;
}
