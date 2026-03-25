import { PublicPractitionerRoutePage } from "@/components/directory/public-practitioner-route-page";

export default async function DirectoryPractitionerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <PublicPractitionerRoutePage slug={slug} />;
}
