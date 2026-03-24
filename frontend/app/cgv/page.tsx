import { LegalPageShell } from "@/components/legal/legal-page-shell";

export default function TermsOfSalePage() {
  return (
    <LegalPageShell
      eyebrow="Conditions générales"
      title="Conditions générales de vente"
      introduction="Cette page pose une base minimale pour les conditions de vente de NUADYX. Elle doit être finalisée avec les informations contractuelles et tarifaires définitives avant commercialisation."
      sections={[
        {
          title: "Éditeur",
          content: (
            <>
              <p>ALIOUNE BADARA SECK</p>
              <p>SIREN : 995 288 438</p>
              <p>SIRET : 995 288 438 00014</p>
              <p>Adresse : 1 PLACE GUY ROPARTZ, 29000 QUIMPER</p>
            </>
          ),
        },
        {
          title: "Objet",
          content: (
            <>
              <p>
                NUADYX propose une plateforme permettant aux professionnels du
                massage et du bien-être de présenter leur activité, gérer leurs
                prestations, leurs créneaux, leurs réservations, leurs
                règlements et leur page publique.
              </p>
            </>
          ),
        },
        {
          title: "Tarifs et règlement",
          content: (
            <>
              <p>Grille tarifaire NUADYX : [À compléter manuellement]</p>
              <p>Modalités de facturation : [À compléter manuellement]</p>
              <p>TVA intracommunautaire : [À compléter si applicable]</p>
            </>
          ),
        },
        {
          title: "Résiliation, support et contact",
          content: (
            <>
              <p>Conditions de résiliation : [À compléter manuellement]</p>
              <p>Email de support : [À compléter manuellement]</p>
              <p>Directeur de publication : [À compléter manuellement]</p>
            </>
          ),
        },
      ]}
    />
  );
}
