import SpaModuleWorkspace from "@/components/spa/SpaModuleWorkspace";
import { getSpaModule } from "@/lib/spa-modules";

export default function LegacyMembershipPlansPage() {
  const definition = getSpaModule("catalog", "offerings");
  if (!definition) return null;
  return <SpaModuleWorkspace definition={definition} />;
}
