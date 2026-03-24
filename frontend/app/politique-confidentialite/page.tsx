import { LegalPageShell } from "@/components/legal/legal-page-shell";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Confidentialité"
      title="Politique de confidentialité"
      introduction="Cette politique décrit le socle minimal de traitement des données personnelles dans NUADYX. Elle doit être relue et complétée avant toute ouverture commerciale publique."
      sections={[
        {
          title: "Responsable du traitement",
          content: (
            <>
              <p>ALIOUNE BADARA SECK</p>
              <p>Adresse : 1 PLACE GUY ROPARTZ, 29000 QUIMPER</p>
              <p>Email de contact : [À compléter manuellement]</p>
              <p>DPO : [À compléter si applicable]</p>
            </>
          ),
        },
        {
          title: "Données traitées",
          content: (
            <>
              <p>
                NUADYX traite les données nécessaires à la création d’un espace
                praticien, à la publication d’un profil, à la réservation, au
                règlement, au suivi de prestation, aux avis et aux échanges de
                service.
              </p>
              <p>
                Les données peuvent inclure notamment identité, coordonnées,
                informations de réservation, données de règlement, historique de
                suivi, et contenus saisis par les praticiens.
              </p>
            </>
          ),
        },
        {
          title: "Finalités",
          content: (
            <>
              <p>
                Les données sont utilisées pour faire fonctionner le service,
                sécuriser les réservations, assurer les règlements, traiter les
                litiges, envoyer les communications essentielles et améliorer le
                support.
              </p>
            </>
          ),
        },
        {
          title: "Durée de conservation et droits",
          content: (
            <>
              <p>
                Les durées de conservation et les modalités d’exercice des
                droits d’accès, de rectification, d’opposition, d’effacement ou
                de limitation doivent être précisées avant mise en ligne.
              </p>
              <p>Modalités de contact : [À compléter manuellement]</p>
            </>
          ),
        },
        {
          title: "Sous-traitants et hébergement",
          content: (
            <>
              <p>Hébergeur frontend : [À compléter manuellement]</p>
              <p>Hébergeur backend : [À compléter manuellement]</p>
              <p>Prestataire de paiement : Stripe</p>
            </>
          ),
        },
      ]}
    />
  );
}
