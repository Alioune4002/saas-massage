import { DirectoryCandidatePage } from "@/components/directory/directory-candidate-page";

export default async function DirectoryCandidateRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <DirectoryCandidatePage slug={slug} />;
}
