import { ClaimPage } from "@/components/directory/claim-page";

export default async function ClaimTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <ClaimPage token={token} />;
}
