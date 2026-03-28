import type { ReactNode } from "react";

export type LegalDocumentSlug =
  | "mentions-legales"
  | "cgu"
  | "cgv"
  | "contrat-praticien"
  | "confidentialite"
  | "cookies"
  | "politique-avis"
  | "annulation-remboursement";

export type LegalDocumentSection = {
  title: string;
  content: ReactNode;
};

export type LegalDocumentDefinition = {
  slug: LegalDocumentSlug;
  route: string;
  eyebrow: string;
  title: string;
  introduction: string;
  version: string;
  sections: LegalDocumentSection[];
};

export const LEGAL_DOCUMENT_VERSIONS: Record<LegalDocumentSlug, string> = {
  "mentions-legales": "2026-03-25",
  cgu: "2026-03-25",
  cgv: "2026-03-25",
  "contrat-praticien": "2026-03-25",
  confidentialite: "2026-03-25",
  cookies: "2026-03-25",
  "politique-avis": "2026-03-25",
  "annulation-remboursement": "2026-03-25",
};

const sharedHostSection = (
  <>
    <p>Hébergeur front-end : Vercel Inc.</p>
    <p>Adresse de l’hébergeur front-end : 440 N Barranca Ave #4133, Covina, CA 91723, United States</p>
    <p>Hébergeur back-end : Heroku, Inc.</p>
    <p>Adresse de l’hébergeur back-end : 415 Mission Street, Suite 300, San Francisco, CA 94105, United States</p>
  </>
);

const consumerMediatorSection = (
  <>
    <p>Email de support : support@nuadyx.com</p>
    <p>
      Médiation de la consommation : ce bloc est réservé aux coordonnées définitives du médiateur
      de la consommation applicable à NUADYX.
    </p>
    <p>
      Coordonnées à publier dès adhésion effective : nom du médiateur, adresse postale et site
      internet.
    </p>
    <p>Les présentes CGV sont soumises au droit français.</p>
  </>
);

export const LEGAL_DOCUMENTS: Record<LegalDocumentSlug, LegalDocumentDefinition> = {
  "mentions-legales": {
    slug: "mentions-legales",
    route: "/mentions-legales",
    eyebrow: "Mentions légales",
    title: "Mentions légales",
    version: LEGAL_DOCUMENT_VERSIONS["mentions-legales"],
    introduction:
      "Informations légales d’identification de NUADYX, de son rôle de plateforme et des conditions générales d’accès au service.",
    sections: [
      {
        title: "Éditeur du service",
        content: (
          <>
            <p>ALIOUNE BADARA SECK</p>
            <p>Entreprise individuelle</p>
            <p>SIREN : 995 288 438</p>
            <p>SIRET : 995 288 438 00014</p>
            <p>Code APE / NAF : 62.01Z – Programmation informatique</p>
            <p>Adresse : 1 PLACE GUY ROPARTZ, 29000 QUIMPER, France</p>
            <p>Adresse e-mail de contact : contact@nuadyx.com</p>
            <p>Adresse e-mail support : support@nuadyx.com</p>
            <p>TVA intracommunautaire : FR74995288438</p>
            <p>Directeur de la publication : Alioune Badara Seck</p>
          </>
        ),
      },
      { title: "Hébergement", content: sharedHostSection },
      {
        title: "Présentation du service",
        content: (
          <>
            <p>
              NUADYX est une plateforme numérique permettant notamment à des professionnels du massage et du bien-être de créer un espace professionnel, présenter leurs services, publier un profil, gérer leurs disponibilités, recevoir des réservations, encaisser des règlements selon les fonctionnalités activées sur la plateforme, échanger avec leurs clients et administrer leur activité en ligne.
            </p>
          </>
        ),
      },
      {
        title: "Statut de la plateforme",
        content: (
          <>
            <p>
              NUADYX agit en qualité d’éditeur de plateforme et, selon les fonctionnalités utilisées, d’intermédiaire technique pour la mise en relation entre praticiens et clients.
            </p>
            <p>
              Sauf mention contraire expresse, NUADYX n’est pas le prestataire matériel de la prestation de massage ou de bien-être réservée via la plateforme. La prestation est réalisée sous la seule responsabilité du praticien concerné.
            </p>
          </>
        ),
      },
      {
        title: "Santé et bien-être",
        content: (
          <>
            <p>
              Les prestations proposées sur la plateforme relèvent du bien-être, sauf indication contraire clairement portée par le professionnel concerné.
            </p>
            <p>
              NUADYX ne fournit pas d’acte médical, paramédical ou thérapeutique.
            </p>
            <p>
              Le massage thérapeutique demeure encadré spécifiquement ; la plateforme est destinée aux prestations de bien-être proposées par les professionnels référencés.
            </p>
          </>
        ),
      },
      {
        title: "Accès au service",
        content: (
          <>
            <p>
              Le site est accessible 24h/24 et 7j/7, sauf interruption programmée ou non, notamment pour les besoins de maintenance, de sécurité ou en cas de force majeure.
            </p>
            <p>
              NUADYX ne saurait être tenu responsable des dommages résultant d’une indisponibilité temporaire du service, dans les limites prévues par la loi.
            </p>
          </>
        ),
      },
      {
        title: "Propriété intellectuelle",
        content: (
          <>
            <p>
              L’ensemble des éléments composant le site et la plateforme NUADYX, notamment les textes, graphismes, logos, signes distinctifs, interfaces, bases de données, logiciels, structures, contenus éditoriaux et éléments techniques, est protégé par les dispositions applicables en matière de propriété intellectuelle.
            </p>
            <p>
              Sauf autorisation écrite préalable, toute reproduction, représentation, adaptation, extraction, réutilisation ou exploitation, totale ou partielle, est interdite.
            </p>
          </>
        ),
      },
      {
        title: "Données personnelles et cookies",
        content: (
          <>
            <p>
              NUADYX traite des données personnelles dans les conditions décrites dans sa Politique de confidentialité. Pour toute demande relative aux données personnelles : contact@nuadyx.com.
            </p>
            <p>
              NUADYX peut utiliser des cookies et autres traceurs nécessaires au fonctionnement du service, ainsi que, le cas échéant, des cookies de mesure d’audience ou publicitaires selon les choix de l’utilisateur.
            </p>
          </>
        ),
      },
      {
        title: "Contact et réclamations",
        content: (
          <>
            <p>Pour toute question, réclamation, signalement ou demande d’assistance : contact@nuadyx.com</p>
            <p>Support technique : support@nuadyx.com</p>
          </>
        ),
      },
    ],
  },
  cgu: {
    slug: "cgu",
    route: "/cgu",
    eyebrow: "Conditions d’utilisation",
    title: "Conditions Générales d’Utilisation",
    version: LEGAL_DOCUMENT_VERSIONS.cgu,
    introduction:
      "Conditions d’accès et d’utilisation de la plateforme NUADYX applicables aux visiteurs, clients et praticiens.",
    sections: [
      {
        title: "Objet et acceptation",
        content: (
          <>
            <p>
              Les présentes Conditions Générales d’Utilisation ont pour objet de définir les conditions d’accès et d’utilisation du site et de la plateforme NUADYX par tout utilisateur, qu’il soit simple visiteur, client réservant une prestation, ou professionnel du massage et du bien-être utilisant les services proposés.
            </p>
            <p>
              L’accès à certaines fonctionnalités de NUADYX implique l’acceptation pleine et entière des présentes CGU. L’utilisateur reconnaît avoir pris connaissance des CGU et s’engage à les respecter.
            </p>
          </>
        ),
      },
      {
        title: "Description du service",
        content: (
          <ul className="list-disc space-y-2 pl-5">
            <li>création et gestion de comptes utilisateurs ;</li>
            <li>création et publication de profils professionnels ;</li>
            <li>présentation de prestations, disponibilités et tarifs ;</li>
            <li>réservation de créneaux ;</li>
            <li>paiement ou gestion des règlements selon les modules activés ;</li>
            <li>gestion administrative et relationnelle des réservations ;</li>
            <li>publication d’avis ou retours d’expérience.</li>
          </ul>
        ),
      },
      {
        title: "Accès, comptes et sécurité",
        content: (
          <>
            <p>L’utilisateur doit disposer d’un équipement compatible et d’un accès internet.</p>
            <p>
              NUADYX se réserve le droit de suspendre, limiter ou interrompre l’accès au service pour des raisons de maintenance, de sécurité, de fraude présumée, de non-respect des présentes CGU ou de toute obligation légale.
            </p>
            <p>
              L’utilisateur s’engage à fournir des informations exactes, à jour et complètes. Il est seul responsable de la confidentialité de ses identifiants et de toute utilisation effectuée depuis son compte.
            </p>
          </>
        ),
      },
      {
        title: "Rôle de NUADYX",
        content: (
          <ul className="list-disc space-y-2 pl-5">
            <li>NUADYX fournit un service de plateforme ;</li>
            <li>NUADYX n’exécute pas matériellement les prestations réservées ;</li>
            <li>NUADYX n’agit pas comme employeur des praticiens ;</li>
            <li>NUADYX n’est pas partie au contrat de prestation conclu directement entre le client et le praticien, sauf obligations propres à l’intermédiation, au paiement ou au support de plateforme.</li>
          </ul>
        ),
      },
      {
        title: "Obligations des praticiens et des clients",
        content: (
          <>
            <p>
              Chaque praticien s’engage à exercer son activité dans le respect des lois et règlements applicables, à ne proposer que des prestations licites et conformes à son champ de compétence, à fournir des informations sincères et à souscrire les assurances nécessaires.
            </p>
            <p>
              Le client s’engage à fournir des informations exactes lors de la réservation, respecter les conditions de réservation, de paiement, de report et d’annulation applicables, et adopter un comportement respectueux envers les praticiens et le support.
            </p>
          </>
        ),
      },
      {
        title: "Référencement, classement et avis",
        content: (
          <>
            <p>
              L’ordre d’affichage des profils, prestations ou contenus peut dépendre de plusieurs paramètres, notamment la complétude du profil, la disponibilité, la pertinence géographique, la qualité des informations fournies, l’historique d’activité, les avis publiés, la réactivité, l’ancienneté sur la plateforme, ou l’existence d’options de mise en avant lorsque celles-ci sont proposées.
            </p>
            <p>
              Lorsque la plateforme permet la publication d’avis, seuls les avis respectueux de la loi, des bonnes mœurs et des présentes CGU peuvent être publiés. NUADYX peut modérer, refuser, déréférencer ou supprimer tout avis manifestement illicite, injurieux, diffamatoire, hors sujet, frauduleux ou contraire à l’intérêt légitime du service.
            </p>
          </>
        ),
      },
      {
        title: "Paiement, fraude et contenus",
        content: (
          <>
            <p>
              Lorsque le paiement en ligne est activé, les flux sont traités via un prestataire spécialisé, notamment Stripe. NUADYX n’a pas vocation à stocker en clair les données complètes de carte bancaire.
            </p>
            <p>
              NUADYX se réserve le droit de demander tout justificatif utile, de suspendre un compte, de bloquer une réservation, de différer un versement, de refuser une transaction ou de fermer l’accès au service en cas de suspicion de fraude, blanchiment, activité illicite, usage abusif, risque de rétrofacturation anormal ou manquement contractuel.
            </p>
            <p>
              Chaque utilisateur demeure responsable des contenus, informations, images, descriptions, documents, messages et éléments qu’il met en ligne sur la plateforme.
            </p>
          </>
        ),
      },
      {
        title: "Disponibilité, responsabilité et droit applicable",
        content: (
          <>
            <p>
              NUADYX met en œuvre des mesures raisonnables de sécurité et d’intégrité du service, mais ne garantit pas une disponibilité ininterrompue ni l’absence totale d’erreurs ou de vulnérabilités.
            </p>
            <p>
              NUADYX n’est responsable que des dommages directs prouvés qui lui sont imputables, dans les limites autorisées par la loi.
            </p>
            <p>Les présentes CGU sont soumises au droit français.</p>
          </>
        ),
      },
    ],
  },
  cgv: {
    slug: "cgv",
    route: "/cgv",
    eyebrow: "Conditions commerciales",
    title: "Conditions Générales de Vente",
    version: LEGAL_DOCUMENT_VERSIONS.cgv,
    introduction:
      "Conditions commerciales applicables aux offres payantes de NUADYX et aux conditions de souscription lorsqu’une offre monétisée est ouverte.",
    sections: [
      {
        title: "Éditeur et objet",
        content: (
          <>
            <p>ALIOUNE BADARA SECK — SIREN 995 288 438 — SIRET 995 288 438 00014</p>
            <p>Adresse : 1 PLACE GUY ROPARTZ, 29000 QUIMPER, France</p>
            <p>Email : contact@nuadyx.com — Support : support@nuadyx.com</p>
            <p>TVA intracommunautaire : FR74995288438</p>
            <p>
              Les présentes CGV régissent les conditions dans lesquelles NUADYX fournit aux professionnels et, le cas échéant, aux autres utilisateurs souscrivant une offre payante, un accès à ses services numériques.
            </p>
          </>
        ),
      },
      {
        title: "Services couverts",
        content: (
          <ul className="list-disc space-y-2 pl-5">
            <li>création et gestion d’un profil professionnel ;</li>
            <li>agenda et gestion des disponibilités ;</li>
            <li>réception et suivi des réservations ;</li>
            <li>gestion des paiements ;</li>
            <li>page publique ou mini-site ;</li>
            <li>outils de relation client ;</li>
            <li>support technique.</li>
          </ul>
        ),
      },
      {
        title: "Tarifs, souscription et paiement",
        content: (
          <>
            <p>
              Pendant la phase actuelle de lancement, l’inscription et
              l’utilisation standard de NUADYX sont proposées gratuitement aux
              praticiens.
            </p>
            <p>
              Si une offre payante est ouverte ultérieurement, son prix, sa
              durée et ses conditions seront affichés clairement avant toute
              souscription.
            </p>
            <p>
              La souscription est réputée conclue à compter de la validation de la commande et, si applicable, du premier paiement.
            </p>
            <p>
              Le paiement peut être effectué par carte bancaire ou tout autre moyen proposé sur la plateforme via le prestataire de paiement indiqué au moment de la commande. Les paiements sont traités via Stripe lorsque cette solution est activée.
            </p>
          </>
        ),
      },
      {
        title: "Rétractation, conformité et résiliation",
        content: (
          <>
            <p>
              Si le client est un consommateur, il bénéficie en principe d’un délai légal de 14 jours pour se rétracter pour les contrats conclus à distance, sauf exception légale.
            </p>
            <p>
              Lorsque le Client consommateur demande l’exécution immédiate du service avant la fin du délai légal de rétractation, il reconnaît expressément que cette exécution peut entraîner la perte de son droit de rétractation dans les cas prévus par la loi.
            </p>
            <p>
              Le Client peut résilier son abonnement depuis son espace ou par e-mail à support@nuadyx.com. Sauf stipulation contraire de l’offre souscrite, la résiliation prend effet à l’échéance de la période en cours.
            </p>
          </>
        ),
      },
      {
        title: "Support, médiation et droit applicable",
        content: consumerMediatorSection,
      },
    ],
  },
  "contrat-praticien": {
    slug: "contrat-praticien",
    route: "/contrat-praticien",
    eyebrow: "Professionnels",
    title: "Conditions spécifiques praticiens",
    version: LEGAL_DOCUMENT_VERSIONS["contrat-praticien"],
    introduction:
      "Conditions spécifiques encadrant l’utilisation de NUADYX par les praticiens et la vérification d’activité.",
    sections: [
      {
        title: "Objet, acceptation et statut",
        content: (
          <>
            <p>
              Les présentes Conditions Spécifiques Praticiens régissent les relations entre NUADYX et tout professionnel créant un compte praticien ou utilisant les services proposés sur la plateforme.
            </p>
            <p>
              Le praticien agit en qualité de professionnel indépendant, sous sa seule responsabilité juridique, fiscale, sociale, déontologique et assurantielle.
            </p>
            <p>
              NUADYX n’est ni son employeur, ni son mandataire général, ni son représentant légal. Le praticien demeure seul responsable de la licéité, de la qualité, de la sécurité et de la conformité des prestations proposées.
            </p>
          </>
        ),
      },
      {
        title: "Éligibilité et vérification",
        content: (
          <>
            <p>
              Le praticien déclare être juridiquement capable et valablement immatriculé pour exercer son activité, disposer d’un SIREN/SIRET actif et proposer uniquement des prestations licites.
            </p>
            <p>
              Afin de renforcer la confiance, prévenir la fraude et sécuriser les paiements, NUADYX peut mettre en place une procédure de vérification d’identité et de vérification d’activité.
            </p>
            <p>
              Le badge “Praticien vérifié” signifie uniquement que NUADYX a procédé à certaines vérifications documentaires ou automatisées sur l’identité et/ou l’immatriculation du praticien à une date donnée. Il ne constitue ni garantie de qualité, ni certification officielle, ni validation médicale.
            </p>
          </>
        ),
      },
      {
        title: "Obligations du praticien",
        content: (
          <ul className="list-disc space-y-2 pl-5">
            <li>exercer de manière loyale, professionnelle et conforme à la réglementation ;</li>
            <li>publier des informations sincères sur ses prestations, tarifs, durées, disponibilités et lieux d’exercice ;</li>
            <li>honorer les réservations confirmées, sauf cas légitime ;</li>
            <li>ne pas contourner frauduleusement la plateforme ;</li>
            <li>ne pas manipuler les avis, notations ou signaux de classement ;</li>
            <li>ne pas publier de contenus trompeurs, diffamatoires ou illicites.</li>
          </ul>
        ),
      },
      {
        title: "Assurance et responsabilité",
        content: (
          <>
            <p>
              Le praticien s’engage à maintenir pendant toute la durée d’utilisation de la plateforme une assurance responsabilité civile professionnelle valide, couvrant au minimum les dommages corporels, matériels et immatériels causés aux clients ou à des tiers dans le cadre de son activité.
            </p>
            <p>
              Le praticien est seul responsable de l’exécution de la prestation, des informations figurant sur son profil, des tarifs annoncés, des annulations, retards, absences et incidents d’exécution.
            </p>
          </>
        ),
      },
      {
        title: "Paiements, annulations et classement",
        content: (
          <>
            <p>
              Lorsque les paiements transitent via la plateforme ou via un prestataire connecté, NUADYX peut s’appuyer sur Stripe ou tout prestataire équivalent. NUADYX peut suspendre, différer ou bloquer un reversement en cas de contestation, chargeback, suspicion de fraude, remboursement en cours ou dossier KYC incomplet.
            </p>
            <p>
              Le praticien accepte la politique d’annulation et de remboursement applicable sur la plateforme.
            </p>
            <p>
              NUADYX peut référencer, déréférencer, classer ou reclasser les profils selon différents critères, notamment la complétude du profil, la conformité documentaire, la disponibilité, la qualité du service, le taux de réponse, les annulations, les signalements et les avis.
            </p>
          </>
        ),
      },
      {
        title: "Suspension, résiliation et droit applicable",
        content: (
          <>
            <p>
              NUADYX peut suspendre immédiatement, totalement ou partiellement, l’accès du praticien en cas notamment de dossier incomplet, fraude, faux avis, absence d’assurance, non-conformité réglementaire, atteinte à la sécurité ou risque réputationnel sérieux.
            </p>
            <p>
              Les présentes conditions sont régies par le droit français. Pour les litiges avec un praticien professionnel, compétence expresse est attribuée aux tribunaux du ressort de Quimper, sous réserve de toute règle impérative contraire.
            </p>
          </>
        ),
      },
    ],
  },
  confidentialite: {
    slug: "confidentialite",
    route: "/confidentialite",
    eyebrow: "Données personnelles",
    title: "Politique de confidentialité",
    version: LEGAL_DOCUMENT_VERSIONS.confidentialite,
    introduction:
      "Politique décrivant les traitements de données personnelles effectués via NUADYX, leurs finalités et les droits des personnes concernées.",
    sections: [
      {
        title: "Responsable du traitement",
        content: (
          <>
            <p>ALIOUNE BADARA SECK</p>
            <p>Adresse : 1 PLACE GUY ROPARTZ, 29000 QUIMPER, France</p>
            <p>Email : contact@nuadyx.com</p>
            <p>Support : support@nuadyx.com</p>
            <p>DPO : Aucun DPO désigné à ce jour.</p>
          </>
        ),
      },
      {
        title: "Personnes concernées et données traitées",
        content: (
          <>
            <p>NUADYX peut traiter les données des visiteurs, clients, praticiens, prospects et personnes contactant le support.</p>
            <p>
              Selon les usages de la plateforme, NUADYX peut traiter des données d’identification, coordonnées, données de connexion et de sécurité, données de compte, de réservation, de planning, de paiement, de facturation, contenus échangés, avis, données techniques de navigation et pièces justificatives demandées à des fins de vérification.
            </p>
          </>
        ),
      },
      {
        title: "Finalités et bases légales",
        content: (
          <>
            <p>
              Les données sont traitées pour créer et administrer les comptes, permettre l’utilisation du service, gérer les réservations, traiter les paiements, prévenir la fraude, répondre aux demandes d’assistance, gérer les litiges, envoyer les communications de service et satisfaire aux obligations légales et réglementaires.
            </p>
            <p>
              Les traitements reposent, selon les cas, sur l’exécution d’un contrat ou de mesures précontractuelles, le respect d’obligations légales, l’intérêt légitime de NUADYX et le consentement lorsque celui-ci est requis.
            </p>
          </>
        ),
      },
      {
        title: "Destinataires, hébergement et transferts",
        content: (
          <>
            <p>Les données peuvent être accessibles à l’équipe interne habilitée de NUADYX, à ses sous-traitants techniques, au prestataire de paiement Stripe et aux autorités compétentes lorsque la loi l’exige.</p>
            {sharedHostSection}
            <p>Prestataire de paiement : Stripe</p>
            <p>
              Certains prestataires techniques peuvent traiter des données en dehors de l’Union européenne. Dans ce cas, NUADYX encadre ces transferts conformément au RGPD.
            </p>
          </>
        ),
      },
      {
        title: "Durées de conservation",
        content: (
          <ul className="list-disc space-y-2 pl-5">
            <li>Compte utilisateur actif : pendant toute la durée du compte</li>
            <li>Données de réservation / relation contractuelle : durée nécessaire à la gestion de la relation, puis archivage intermédiaire selon les obligations légales</li>
            <li>Données de facturation et pièces comptables : 10 ans</li>
            <li>Données de support : jusqu’à 3 ans à compter du dernier échange utile</li>
            <li>Données liées à la sécurité et à la fraude : durée strictement nécessaire à la prévention, à la détection et à la preuve</li>
          </ul>
        ),
      },
      {
        title: "Droits des personnes et sécurité",
        content: (
          <>
            <p>
              Toute personne concernée dispose, dans les conditions légales, d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition, de portabilité lorsque ce droit est applicable, et peut introduire une réclamation auprès de la CNIL.
            </p>
            <p>Les demandes peuvent être adressées à contact@nuadyx.com.</p>
            <p>
              NUADYX met en œuvre des mesures techniques et organisationnelles appropriées pour protéger les données contre la destruction, la perte, l’altération, la divulgation non autorisée ou l’accès non autorisé.
            </p>
          </>
        ),
      },
    ],
  },
  cookies: {
    slug: "cookies",
    route: "/cookies",
    eyebrow: "Cookies et CMP",
    title: "Politique cookies",
    version: LEGAL_DOCUMENT_VERSIONS.cookies,
    introduction:
      "Politique relative aux cookies, traceurs et préférences de consentement sur le site et la plateforme NUADYX.",
    sections: [
      {
        title: "Qu’est-ce qu’un cookie ?",
        content: (
          <p>
            Un cookie ou traceur est un fichier ou une technologie permettant de lire ou d’écrire des informations sur le terminal de l’utilisateur lors de sa navigation.
          </p>
        ),
      },
      {
        title: "Catégories de traceurs",
        content: (
          <ul className="list-disc space-y-2 pl-5">
            <li>cookies strictement nécessaires au fonctionnement et à la sécurité ;</li>
            <li>cookies de mesure d’audience ;</li>
            <li>cookies publicitaires et de retargeting ;</li>
            <li>pixels et traceurs tiers de support ou d’intégration technique.</li>
          </ul>
        ),
      },
      {
        title: "Base légale et gestion du consentement",
        content: (
          <>
            <p>
              Les cookies non nécessaires sont déposés ou lus uniquement après consentement de l’utilisateur, lorsqu’un tel consentement est requis.
            </p>
            <p>
              Lors de la première visite, l’utilisateur peut accepter, refuser ou paramétrer ses choix. Il peut modifier ses préférences à tout moment via le lien “Gérer mes cookies”.
            </p>
          </>
        ),
      },
      {
        title: "Durée et contact",
        content: (
          <>
            <p>
              Les préférences de consentement, ainsi que les durées de vie des cookies, sont conservées pour une durée proportionnée et conforme à la réglementation et aux paramétrages retenus.
            </p>
            <p>Pour toute question relative aux cookies : contact@nuadyx.com</p>
          </>
        ),
      },
    ],
  },
  "politique-avis": {
    slug: "politique-avis",
    route: "/politique-avis",
    eyebrow: "Avis clients",
    title: "Politique des avis",
    version: LEGAL_DOCUMENT_VERSIONS["politique-avis"],
    introduction:
      "Règles applicables à la collecte, la modération, la publication, la réponse et le retrait des avis sur NUADYX.",
    sections: [
      {
        title: "Qui peut laisser un avis ?",
        content: (
          <p>
            Seuls les utilisateurs ayant effectivement réservé une prestation via la plateforme, ou dont l’expérience peut être raisonnablement reliée à une prestation réelle, peuvent être autorisés à publier un avis.
          </p>
        ),
      },
      {
        title: "Contrôle et modération",
        content: (
          <>
            <p>
              Les avis peuvent faire l’objet d’une modération humaine ou automatisée avant ou après publication afin de vérifier leur conformité aux présentes règles.
            </p>
            <p>
              Ce contrôle vise notamment à détecter les faux avis, propos injurieux, haineux ou discriminatoires, contenus hors sujet, divulgation de données sensibles, conflits d’intérêts et avis déposés par le praticien lui-même ou par un proche agissant pour lui.
            </p>
          </>
        ),
      },
      {
        title: "Informations affichées avec l’avis",
        content: (
          <ul className="list-disc space-y-2 pl-5">
            <li>date de publication ;</li>
            <li>date de l’expérience ou du rendez-vous ;</li>
            <li>indication sur l’existence ou non d’un contrôle ;</li>
            <li>méthode de classement principale ;</li>
            <li>mention “Avis vérifié” lorsqu’un avis est lié à une réservation réelle.</li>
          </ul>
        ),
      },
      {
        title: "Réponse praticien et suppression",
        content: (
          <>
            <p>
              Le praticien peut répondre publiquement à un avis via son espace, sous réserve de respecter la courtoisie, la confidentialité et l’interdiction de divulguer des données personnelles ou médicales.
            </p>
            <p>
              NUADYX peut refuser, retirer, masquer ou déréférencer un avis s’il est illicite, faux, manifestement trompeur, hors sujet, excessif, ou s’il résulte d’une tentative de pression ou de chantage.
            </p>
          </>
        ),
      },
    ],
  },
  "annulation-remboursement": {
    slug: "annulation-remboursement",
    route: "/annulation-remboursement",
    eyebrow: "Réservations",
    title: "Politique d’annulation, de remboursement et d’absence",
    version: LEGAL_DOCUMENT_VERSIONS["annulation-remboursement"],
    introduction:
      "Règles de principe applicables aux annulations, reports, retards, no-show et contestations sur NUADYX.",
    sections: [
      {
        title: "Annulation par le client",
        content: (
          <ul className="list-disc space-y-2 pl-5">
            <li>plus de 48 heures avant le rendez-vous : remboursement intégral ou report intégral ;</li>
            <li>entre 48 heures et 24 heures avant le rendez-vous : remboursement à hauteur de 50 % ou avoir équivalent ;</li>
            <li>moins de 24 heures avant le rendez-vous : aucun remboursement, sauf geste commercial du praticien ou cas exceptionnel accepté ;</li>
            <li>après l’horaire prévu de début de prestation : considéré comme no-show client, aucun remboursement.</li>
          </ul>
        ),
      },
      {
        title: "Report, retard et no-show client",
        content: (
          <>
            <p>Un report peut être accepté selon les disponibilités du praticien. NUADYX ou le praticien peut limiter le nombre de reports afin d’éviter les abus.</p>
            <p>
              En cas de retard, la prestation peut être écourtée pour respecter le planning et le tarif initial peut rester dû en totalité. Au-delà de 15 minutes de retard sans information préalable, le rendez-vous peut être considéré comme non honoré.
            </p>
          </>
        ),
      },
      {
        title: "Annulation par le praticien et cas exceptionnels",
        content: (
          <>
            <p>
              En cas d’annulation par le praticien, le client est remboursé intégralement ou, avec son accord, un report lui est proposé.
            </p>
            <p>
              NUADYX ou le praticien pourra accorder un remboursement total ou partiel en cas de force majeure, urgence médicale sérieuse, événement grave dûment justifié ou dysfonctionnement technique imputable à la plateforme.
            </p>
          </>
        ),
      },
      {
        title: "Chargebacks et contestations",
        content: (
          <p>
            En cas de contestation bancaire ou de demande de rétrofacturation, NUADYX pourra bloquer temporairement les sommes concernées et demander tout justificatif utile. Le praticien accepte de coopérer pleinement à la gestion des litiges et contestations de paiement.
          </p>
        ),
      },
    ],
  },
};

export const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu", label: "CGU" },
  { href: "/cgv", label: "CGV" },
  { href: "/contrat-praticien", label: "Contrat praticien" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/cookies", label: "Cookies" },
  { href: "/politique-avis", label: "Politique des avis" },
  { href: "/annulation-remboursement", label: "Annulation / remboursement" },
];

export const PRACTITIONER_REQUIRED_DOCUMENTS: LegalDocumentSlug[] = [
  "cgu",
  "cgv",
  "contrat-praticien",
  "confidentialite",
];

export function getLegalDocument(slug: LegalDocumentSlug) {
  return LEGAL_DOCUMENTS[slug];
}
