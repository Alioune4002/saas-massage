import type { Metadata } from "next";

import { DirectorySeoPage } from "@/components/directory/directory-seo-page";
import { CITY_DIRECTORY_PAGES } from "@/lib/directory";

const config = CITY_DIRECTORY_PAGES.brest;

export const metadata: Metadata = {
  title: config.title,
  description: config.description,
};

export default function MassageBrestPage() {
  return <DirectorySeoPage config={config} />;
}
