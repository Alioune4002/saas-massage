import { ClaimPage } from "@/components/directory/claim-page";

type ClaimIndexPageProps = {
  searchParams?: Promise<{
    profile?: string;
  }>;
};

export default async function ClaimIndexPage({ searchParams }: ClaimIndexPageProps) {
  const params = (await searchParams) ?? {};

  return <ClaimPage profileId={params.profile ?? ""} />;
}
