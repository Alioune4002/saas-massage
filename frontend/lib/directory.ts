export const MASSAGE_CATEGORY_LABELS: Record<string, string> = {
  relaxant: "Massage relaxant",
  deep_tissue: "Massage deep tissue",
  tantrique: "Massage tantrique",
};

export type DirectorySeoPageConfig = {
  kind: "city" | "category";
  slug: string;
  h1: string;
  title: string;
  description: string;
  city?: string;
  category?: "relaxant" | "deep_tissue" | "tantrique";
  seoParagraphs: string[];
  faq: Array<{ question: string; answer: string }>;
  relatedLinks: Array<{ href: string; label: string }>;
};

export const CITY_DIRECTORY_PAGES: Record<string, DirectorySeoPageConfig> = {
  quimper: {
    kind: "city",
    slug: "massage-quimper",
    city: "Quimper",
    h1: "Massage à Quimper",
    title: "Massage à Quimper | Annuaire NUADYX",
    description:
      "Découvrez les praticiens du massage et du bien-être à Quimper sur NUADYX. Pages praticiens, spécialités et demandes de rendez-vous.",
    seoParagraphs: [
      "NUADYX prépare un annuaire clair des praticiens du massage et du bien-être à Quimper. Chaque page praticien permet de présenter son univers, ses soins, ses spécialités et sa manière d’accueillir.",
      "Si aucun praticien n’est encore référencé dans votre quartier, vous pouvez créer une page praticien gratuitement pendant le lancement ou demander à être prévenu lorsque de nouveaux profils sont visibles dans la ville.",
    ],
    faq: [
      {
        question: "Comment trouver un praticien massage à Quimper ?",
        answer:
          "Consultez les pages praticiens déjà visibles, comparez leur approche, leurs spécialités et leurs informations pratiques, puis choisissez le profil qui vous inspire confiance.",
      },
      {
        question: "Puis-je rejoindre l’annuaire si je pratique à Quimper ?",
        answer:
          "Oui. L’inscription est gratuite pendant le lancement et permet de créer votre page praticien partageable.",
      },
    ],
    relatedLinks: [
      { href: "/massage-relaxant", label: "Massage relaxant" },
      { href: "/massage-deep-tissue", label: "Massage deep tissue" },
      { href: "/massage-tantrique", label: "Massage tantrique" },
    ],
  },
  brest: {
    kind: "city",
    slug: "massage-brest",
    city: "Brest",
    h1: "Massage à Brest",
    title: "Massage à Brest | Annuaire NUADYX",
    description:
      "Consultez les praticiens du massage et du bien-être à Brest sur NUADYX et rejoignez l’annuaire gratuitement pendant le lancement.",
    seoParagraphs: [
      "Cette page rassemble les praticiens du massage et du bien-être visibles à Brest sur NUADYX. L’objectif est de proposer un annuaire plus lisible, avec des pages praticiens simples à partager.",
      "Les premiers praticiens inscrits pendant le lancement peuvent bénéficier d’une visibilité plus forte dans l’annuaire local et poser les bases de leur présence en ligne.",
    ],
    faq: [
      {
        question: "NUADYX est-il déjà ouvert à Brest ?",
        answer:
          "Oui, l’annuaire peut déjà référencer des praticiens à Brest. Si votre ville est encore peu couverte, vous pouvez demander à être prévenu de l’ouverture locale.",
      },
      {
        question: "Que montre une page praticien ?",
        answer:
          "Une page praticien NUADYX présente les soins, les informations pratiques, les créneaux et, lorsqu’ils existent, les avis publiés.",
      },
    ],
    relatedLinks: [
      { href: "/massage-relaxant", label: "Massage relaxant" },
      { href: "/massage-nantes", label: "Massage à Nantes" },
      { href: "/massage-quimper", label: "Massage à Quimper" },
    ],
  },
  nantes: {
    kind: "city",
    slug: "massage-nantes",
    city: "Nantes",
    h1: "Massage à Nantes",
    title: "Massage à Nantes | Annuaire NUADYX",
    description:
      "Trouvez un praticien massage à Nantes, découvrez sa page publique et rejoignez l’annuaire NUADYX gratuitement pendant le lancement.",
    seoParagraphs: [
      "À Nantes, NUADYX met en avant des pages praticiens pensées pour rassurer rapidement les futurs clients: présentation, spécialités, cadre d’accueil et informations de réservation.",
      "Si vous êtes praticien à Nantes, créer votre page maintenant permet de prendre place parmi les premiers profils visibles pendant le lancement de l’annuaire.",
    ],
    faq: [
      {
        question: "Puis-je suggérer un praticien massage à Nantes ?",
        answer:
          "Oui. Vous pouvez utiliser le formulaire de suggestion sur NUADYX pour recommander un praticien ou votre masseur habituel.",
      },
      {
        question: "Les profils affichés sont-ils tous revendiqués ?",
        answer:
          "Non. Certaines fiches peuvent être publiées à titre informatif et restent clairement signalées comme non revendiquées tant que le praticien ne les a pas activées.",
      },
    ],
    relatedLinks: [
      { href: "/massage-deep-tissue", label: "Massage deep tissue" },
      { href: "/massage-relaxant", label: "Massage relaxant" },
      { href: "/massage-brest", label: "Massage à Brest" },
    ],
  },
};

export const CATEGORY_DIRECTORY_PAGES: Record<string, DirectorySeoPageConfig> = {
  relaxant: {
    kind: "category",
    slug: "massage-relaxant",
    category: "relaxant",
    h1: "Massage relaxant",
    title: "Massage relaxant | Annuaire NUADYX",
    description:
      "Découvrez les praticiens proposant des massages relaxants sur NUADYX et trouvez une page praticien claire, partageable et réservable.",
    seoParagraphs: [
      "Le massage relaxant reste l’une des recherches les plus courantes dans le bien-être. NUADYX aide à comparer plus facilement les praticiens qui présentent cette approche sur leur page.",
      "Chaque page praticien peut détailler l’ambiance, le déroulé d’une séance, les créneaux et les conditions de réservation pour rassurer dès le premier contact.",
    ],
    faq: [
      {
        question: "Comment choisir un praticien pour un massage relaxant ?",
        answer:
          "Regardez la présentation, le cadre d’accueil, les spécialités et les informations pratiques pour vérifier que l’approche proposée correspond bien à votre attente.",
      },
      {
        question: "Les massages relaxants sont-ils disponibles partout ?",
        answer:
          "La disponibilité dépend des praticiens déjà visibles dans l’annuaire. Si votre ville n’a pas encore de profil référencé, NUADYX vous invite à revenir plus tard ou à recommander un praticien.",
      },
    ],
    relatedLinks: [
      { href: "/massage-quimper", label: "Massage à Quimper" },
      { href: "/massage-brest", label: "Massage à Brest" },
      { href: "/massage-nantes", label: "Massage à Nantes" },
    ],
  },
  deep_tissue: {
    kind: "category",
    slug: "massage-deep-tissue",
    category: "deep_tissue",
    h1: "Massage deep tissue",
    title: "Massage deep tissue | Annuaire NUADYX",
    description:
      "Trouvez des praticiens proposant du massage deep tissue sur NUADYX et consultez leur page publique en quelques clics.",
    seoParagraphs: [
      "NUADYX prépare un annuaire utile pour les praticiens qui proposent des approches musculaires, profondes ou orientées récupération comme le deep tissue.",
      "Les profils visibles permettent de comprendre plus vite le cadre, les spécialités et les informations pratiques avant de demander un rendez-vous.",
    ],
    faq: [
      {
        question: "Le deep tissue convient-il à tout le monde ?",
        answer:
          "Chaque praticien reste responsable de sa pratique. En cas de doute, il vaut mieux lui poser une question avant réservation et rester prudent sur les situations sensibles.",
      },
      {
        question: "Puis-je créer une page si je propose ce type de massage ?",
        answer:
          "Oui, vous pouvez rejoindre l’annuaire gratuitement pendant le lancement et détailler vos prestations sur votre page praticien.",
      },
    ],
    relatedLinks: [
      { href: "/massage-quimper", label: "Massage à Quimper" },
      { href: "/massage-nantes", label: "Massage à Nantes" },
      { href: "/massage-relaxant", label: "Massage relaxant" },
    ],
  },
  tantrique: {
    kind: "category",
    slug: "massage-tantrique",
    category: "tantrique",
    h1: "Massage tantrique",
    title: "Massage tantrique | Annuaire NUADYX",
    description:
      "Consultez les praticiens qui présentent des massages tantriques sur NUADYX et découvrez une page praticien claire et contextualisée.",
    seoParagraphs: [
      "Cette page regroupe les praticiens qui présentent explicitement une approche tantrique sur NUADYX. Les informations publiées doivent rester claires, responsables et non trompeuses.",
      "Les profils visibles peuvent préciser le cadre, l’intention de la pratique, les conditions de réservation et les informations utiles pour éviter les malentendus.",
    ],
    faq: [
      {
        question: "Comment NUADYX présente ce type de pratique ?",
        answer:
          "NUADYX se limite à un rôle d’annuaire et de page praticien. Les informations doivent rester loyales, sans promesse excessive ni message trompeur.",
      },
      {
        question: "Puis-je demander la suppression d’une fiche ?",
        answer:
          "Oui. Une fiche non revendiquée comporte un formulaire simple pour demander sa suppression ou sa correction.",
      },
    ],
    relatedLinks: [
      { href: "/massage-nantes", label: "Massage à Nantes" },
      { href: "/massage-brest", label: "Massage à Brest" },
      { href: "/massage-relaxant", label: "Massage relaxant" },
    ],
  },
};
