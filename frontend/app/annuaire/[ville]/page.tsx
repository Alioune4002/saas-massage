import type { Metadata } from "next";

import { DirectoryBrowserPage } from "@/components/directory/directory-browser-page";

function formatCityLabel(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function DirectoryCityPage({
  params,
}: {
  params: Promise<{ ville: string }>;
}) {
  const { ville } = await params;
  const cityLabel = formatCityLabel(ville);

  return (
    <DirectoryBrowserPage
      title={`Praticiens massage et bien-être à ${cityLabel}`}
      description={`Découvrez les praticiens et fiches praticiens publiés sur NUADYX à ${cityLabel}. Si aucun praticien n’est encore référencé, vous pouvez créer votre page en premier.`}
      city={cityLabel}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ville: string }>;
}): Promise<Metadata> {
  const { ville } = await params;
  const cityLabel = formatCityLabel(ville);

  return {
    title: `Massage et bien-être à ${cityLabel} | Annuaire NUADYX`,
    description: `Trouvez un praticien du massage et du bien-être à ${cityLabel} sur NUADYX ou soyez le premier à créer votre page dans cette ville.`,
  };
}
