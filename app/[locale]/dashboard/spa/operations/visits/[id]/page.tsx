import TherapistVisitWorkspace from "@/components/spa/TherapistVisitWorkspace";

export default async function TherapistVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TherapistVisitWorkspace visitId={id} />;
}
