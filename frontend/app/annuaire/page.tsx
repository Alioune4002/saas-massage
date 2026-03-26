import type { Metadata } from "next";

import { DirectoryBrowserPage } from "@/components/directory/directory-browser-page";

type DirectorySearchParams = {
  location_type?: string;
  location_slug?: string;
  location_label?: string;
};

function buildLocationCopy(locationType?: string, locationLabel?: string) {
  const label = locationLabel?.trim();
  if (!label) {
    return {
      title: "L’annuaire des praticiens du massage et du bien-être",
      description:
        "Parcourez des pages praticiens revendiquées ou des fiches non revendiquées publiées de manière contrôlée. Chaque fiche peut être corrigée, revendiquée ou retirée.",
      metaTitle: "Annuaire massage et bien-être | NUADYX",
      metaDescription:
        "Parcourez l’annuaire NUADYX des praticiens du massage et du bien-être, trouvez une ville et découvrez des pages praticiens réservable ou revendiquables.",
    };
  }

  const scopeLabel =
    locationType === "postal_code"
      ? `autour du code postal ${label}`
      : locationType === "department"
        ? `dans le département ${label}`
        : locationType === "region"
          ? `dans la région ${label}`
          : `à ${label}`;

  return {
    title: `Praticiens massage et bien-être ${scopeLabel}`,
    description: `Découvrez les praticiens et fiches praticiens visibles sur NUADYX ${scopeLabel}. Si l’offre locale est encore limitée, vous pouvez créer la première page praticien ou recommander un masseur.`,
    metaTitle: `Massage et bien-être ${scopeLabel} | Annuaire NUADYX`,
    metaDescription: `Explorez les praticiens du massage et du bien-être ${scopeLabel} sur NUADYX, avec une recherche locale claire par ville, code postal, département ou région.`,
  };
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<DirectorySearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const locationType = resolvedSearchParams.location_type?.trim() || "";
  const locationSlug = resolvedSearchParams.location_slug?.trim() || "";
  const locationLabel = resolvedSearchParams.location_label?.trim() || "";
  const copy = buildLocationCopy(locationType, locationLabel);

  return (
    <DirectoryBrowserPage
      title={copy.title}
      description={copy.description}
      locationType={locationType}
      locationSlug={locationSlug}
      locationLabel={locationLabel}
    />
  );
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<DirectorySearchParams>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const copy = buildLocationCopy(
    resolvedSearchParams.location_type,
    resolvedSearchParams.location_label
  );

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
  };
}
