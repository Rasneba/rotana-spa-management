import SpaModuleWorkspace from "@/components/spa/SpaModuleWorkspace";
import { getSpaModule } from "@/lib/spa-modules";

export default function ConvertedRatesPage() {
  const definition = getSpaModule("spa", "services");
  if (!definition) return null;
  return <SpaModuleWorkspace definition={definition} />;
}
