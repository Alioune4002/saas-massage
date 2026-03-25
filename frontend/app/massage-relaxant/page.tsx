import type { Metadata } from "next";

import { DirectorySeoPage } from "@/components/directory/directory-seo-page";
import { CATEGORY_DIRECTORY_PAGES } from "@/lib/directory";

const config = CATEGORY_DIRECTORY_PAGES.relaxant;

export const metadata: Metadata = {
  title: config.title,
  description: config.description,
};

export default function MassageRelaxantPage() {
  return <DirectorySeoPage config={config} />;
}
