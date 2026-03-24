import { LegalPageShell } from "@/components/legal/legal-page-shell";

export default function LegalNoticePage() {
  return (
    <LegalPageShell
      eyebrow="Mentions légales"
      title="Mentions légales"
      introduction="Ces informations constituent la base légale minimale de NUADYX avant mise en ligne. Les champs explicitement indiqués comme à compléter doivent être finalisés avant ouverture publique."
      sections={[
        {
          title: "Éditeur du service",
          content: (
            <>
              <p>Nom : ALIOUNE BADARA SECK</p>
              <p>SIREN : 995 288 438</p>
              <p>SIRET : 995 288 438 00014</p>
              <p>Activité : 62.01Z - Programmation informatique</p>
              <p>Adresse : 1 PLACE GUY ROPARTZ, 29000 QUIMPER</p>
              <p>Email de contact : [À compléter manuellement]</p>
              <p>Directeur de publication : [À compléter manuellement]</p>
              <p>TVA intracommunautaire : [À compléter si applicable]</p>
            </>
          ),
        },
        {
          title: "Hébergement",
          content: (
            <>
              <p>Hébergeur frontend : [À compléter manuellement]</p>
              <p>Hébergeur backend : [À compléter manuellement]</p>
            </>
          ),
        },
        {
          title: "Contact et réclamations",
          content: (
            <>
              <p>
                Pour toute question relative au service, aux données ou à une
                demande d’assistance, utilisez l’adresse de contact qui sera
                renseignée ici avant mise en ligne.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
