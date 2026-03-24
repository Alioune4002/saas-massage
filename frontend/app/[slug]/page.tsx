import { PublicProfilePage } from "@/components/public-profile/public-profile-page";

export default async function PractitionerPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <PublicProfilePage slug={slug} />;
}
