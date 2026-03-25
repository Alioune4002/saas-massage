import { RemovalRequestPage } from "@/components/directory/removal-request-page";

export default async function DirectoryRemovalPage({
  params,
}: {
  params: Promise<{ slugOrId: string }>;
}) {
  const { slugOrId } = await params;

  return <RemovalRequestPage slugOrId={slugOrId} />;
}
