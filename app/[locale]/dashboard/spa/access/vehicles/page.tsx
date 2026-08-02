import SpaModuleWorkspace from "@/components/spa/SpaModuleWorkspace";
import { getSpaModule } from "@/lib/spa-modules";

export default function ConvertedVehiclesPage() {
  const definition = getSpaModule("facilities", "equipment");
  if (!definition) return null;
  return <SpaModuleWorkspace definition={definition} />;
}
