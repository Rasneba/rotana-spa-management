import { notFound } from "next/navigation";
import SpaModuleWorkspace from "@/components/spa/SpaModuleWorkspace";
import { getSpaModule } from "@/lib/spa-modules";

export default async function SpaModulePage({
  params,
}: {
  params: Promise<{ section: string; module: string }>;
}) {
  const { section, module } = await params;
  const definition = getSpaModule(section, module);
  if (!definition) notFound();

  return <SpaModuleWorkspace definition={definition} />;
}
