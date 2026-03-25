import { getLegalDocument, type LegalDocumentSlug } from "@/content/legal-documents";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export function LegalDocumentPage({ slug }: { slug: LegalDocumentSlug }) {
  const document = getLegalDocument(slug);

  return (
    <LegalPageShell
      eyebrow={document.eyebrow}
      title={document.title}
      introduction={`${document.introduction} Version ${document.version}.`}
      sections={document.sections}
    />
  );
}
