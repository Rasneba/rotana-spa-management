import DagiLandingPage from "@/components/public/DagiLandingPage";

type Props = { params: Promise<{ locale: string }> };

export default async function Home({ params }: Props) {
  const { locale } = await params;
  return <DagiLandingPage locale={locale} />;
}
