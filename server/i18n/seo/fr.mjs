/**
 * French (fr) SEO content for the Christmas route family (P3B).
 * Natural French search-intent phrasing — not literal machine translation.
 * Honesty constraints: the Santa video's spoken voice is EN/RO only today;
 * the message generator's generated text is EN/RO only today. French copy
 * explains the experience without promising a French-spoken Santa video or
 * French-generated messages.
 */

/** @typedef {import("./_helpers.mjs")} Helpers */

/** @type {Record<string, {
 *   title: string,
 *   description: string,
 *   h1: string,
 *   lede: string,
 *   h2?: string,
 *   h2Body?: string,
 *   links?: Array<{ href: string, label: string }>,
 *   breadcrumbs?: Array<{ href: string, label: string }>,
 *   geo?: { h2: string, body: string },
 *   sections?: Array<{ h2: string, body: string, linkHref?: string, linkLabel?: string, list?: string[] }>,
 *   faqs?: Array<{ q: string, a: string }>,
 * }>} */
export const CHRISTMAS_SEO_CONTENT = {
  "/christmas": {
    title: "Noël chez TheDigitalGifter | Cadeaux, photos, Père Noël et plus",
    description:
      "Créez des cadeaux de Noël, des portraits IA, une vidéo du Père Noël, une liste de souhaits, des cartes et des surprises de l'Avent — des expériences de Noël personnalisées signées TheDigitalGifter.",
    h1: "Offrez un souvenir inoubliable pour ce Noël",
    lede:
      "Découvrez des idées de cadeaux, des portraits photo, une vidéo du Père Noël, un sapin numérique, un calendrier de l'Avent, des cartes et des messages de Noël — tout au même endroit chez TheDigitalGifter.",
    h2: "Expériences de Noël",
    h2Body: "Choisissez un produit de Noël ci-dessous et créez quelque chose de personnel en quelques minutes.",
    links: [
      { href: "/fr/christmas/gift-finder", label: "Trouver le cadeau de Noël idéal" },
      { href: "/fr/christmas/wishlist", label: "Créer une liste de souhaits de Noël" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos de Noël par IA" },
      { href: "/fr/christmas/santa-video", label: "Créer une vidéo personnalisée du Père Noël" },
      { href: "/fr/christmas/tree", label: "Créer un sapin de Noël numérique" },
      { href: "/fr/christmas/advent", label: "Ouvrir le calendrier de l'Avent" },
      { href: "/fr/christmas/cards", label: "Créer une carte de Noël" },
      { href: "/fr/christmas/messages", label: "Trouver un message de Noël" },
    ],
    breadcrumbs: [{ href: "/fr/christmas", label: "Noël" }],
    geo: {
      h2: "Que peut-on créer avec TheDigitalGifter pour Noël ?",
      body:
        "TheDigitalGifter est un espace de création dédié à Noël. Vous pouvez trouver des idées de cadeaux avec le générateur de cadeaux, transformer une photo en portrait de Noël pour la famille, un couple ou un animal, créer une vidéo personnalisée du Père Noël incluant le prénom du destinataire, construire une liste de souhaits partageable, concevoir une carte de Noël avec une photo et un message, écrire des voeux, décorer un sapin numérique et ouvrir des surprises quotidiennes du calendrier de l'Avent. Commencez par un espace puis passez à l'expérience qui correspond à la personne que vous célébrez.",
    },
    sections: [
      {
        h2: "Trouvez le cadeau de Noël idéal",
        body:
          "Vous ne savez pas quoi offrir ? Le générateur de cadeaux de Noël demande pour qui vous cherchez, ce que cette personne aime, sa personnalité et votre budget. Vous obtenez des idées de cadeaux réfléchies avec une courte raison pour chacune — y compris pour quelqu'un qui semble déjà avoir tout. Enregistrez vos favoris dans une liste de souhaits quand vous êtes prêt.",
        linkHref: "/fr/christmas/gift-finder",
        linkLabel: "Trouvez un cadeau de Noël qu'ils vont vraiment adorer",
      },
      {
        h2: "Créez des photos de Noël magiques",
        body:
          "Téléchargez une photo nette et transformez-la en portrait de Noël festif. Créez des looks pour les familles, les couples et les animaux de compagnie — avec des parcours dédiés pour les chiens et les chats — puis téléchargez le résultat en privé ou intégrez-le dans une carte de Noël.",
        linkHref: "/fr/christmas/photo-generator",
        linkLabel: "Transformez votre photo en magie de Noël",
      },
      {
        h2: "Recevez un message personnalisé du Père Noël",
        body:
          "Créez une vidéo de Noël personnalisée du Père Noël. Indiquez le prénom du destinataire et des détails facultatifs comme l'âge, quelque chose qu'il a bien fait, un hobby ou un souhait de Noël. Relisez le message, puis créez une vidéo que vous pourrez télécharger et partager.",
        linkHref: "/fr/christmas/santa-video",
        linkLabel: "Créer une vidéo personnalisée du Père Noël",
      },
      {
        h2: "Créez et partagez une liste de souhaits de Noël",
        body:
          "Construisez une liste de souhaits de Noël avec des liens produits ou des souhaits écrits librement. Partagez un seul lien avec la famille et les amis. Les visiteurs peuvent réserver un cadeau pour éviter les doublons — sans révéler la surprise à la personne qui a créé la liste.",
        linkHref: "/fr/christmas/wishlist",
        linkLabel: "Créer une liste de souhaits de Noël",
      },
      {
        h2: "Créez une carte de Noël personnalisée",
        body:
          "Combinez une photo, un design festif et un message personnel pour créer une carte de Noël à télécharger ou à partager numériquement. Utilisez votre propre photo ou un portrait de Noël déjà créé.",
        linkHref: "/fr/christmas/cards",
        linkLabel: "Créez une carte de Noël qu'ils garderont précieusement",
      },
      {
        h2: "Plus d'expériences de Noël",
        body:
          "Vous pouvez aussi construire un sapin de Noël numérique rempli de surprises, ouvrir les cases du calendrier de l'Avent tout au long de décembre, et trouver les mots justes avec le générateur de messages.",
        list: [
          "Sapin de Noël numérique → /fr/christmas/tree",
          "Calendrier de l'Avent → /fr/christmas/advent",
          "Messages de Noël → /fr/christmas/messages",
        ],
      },
    ],
    faqs: [
      {
        q: "Que puis-je créer pour Noël avec TheDigitalGifter ?",
        a: "Des idées de cadeaux, des portraits de Noël pour les familles, les couples et les animaux, une vidéo personnalisée du Père Noël, une liste de souhaits partageable, des cartes de Noël, des messages de Noël, un sapin numérique et un calendrier de l'Avent.",
      },
      {
        q: "Le Père Noël peut-il dire le prénom de mon enfant ?",
        a: "Oui. Commencez avec son prénom sur la page Noël ou dans l'expérience vidéo du Père Noël, puis ajoutez des détails facultatifs avant de créer la vidéo.",
      },
      {
        q: "Ai-je besoin de compétences en design ?",
        a: "Non. Chaque expérience de Noël est guidée — téléchargez une photo, répondez à quelques questions ou commencez simplement avec un prénom.",
      },
      {
        q: "Est-ce pour des cadeaux numériques, physiques, ou les deux ?",
        a: "Les deux. Utilisez le générateur de cadeaux et la liste de souhaits pour vos achats partout, et créez des portraits numériques, des cartes et des vidéos du Père Noël à envoyer.",
      },
      {
        q: "Cela fonctionne-t-il sur mon téléphone ?",
        a: "Oui. L'espace Noël et les expériences produits sont conçus pour fonctionner aussi bien sur téléphone que sur ordinateur.",
      },
    ],
  },

  "/christmas/gift-finder": {
    title: "Générateur de cadeaux de Noël | Trouvez le cadeau idéal | TheDigitalGifter",
    description:
      "Trouvez des idées de cadeaux de Noël réfléchies selon la personne à qui vous offrez, ses centres d'intérêt, sa personnalité et votre budget.",
    h1: "Trouvez un cadeau de Noël qu'ils vont vraiment adorer",
    lede:
      "Répondez à quelques questions sur la personne à qui vous offrez et obtenez des idées de cadeaux de Noël personnalisées selon ses centres d'intérêt, sa personnalité et votre budget.",
    h2: "Outils de Noël associés",
    links: [
      { href: "/fr/christmas/wishlist", label: "Créer une liste de souhaits de Noël" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos de Noël" },
      { href: "/fr/christmas/tree", label: "Sapin de Noël numérique" },
      { href: "/fr/christmas", label: "Toutes les expériences de Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/gift-finder", label: "Trouveur de cadeaux" },
    ],
    geo: {
      h2: "Qu'est-ce qu'un générateur de cadeaux de Noël ?",
      body:
        "Un générateur de cadeaux de Noël est un outil guidé qui recommande des idées de cadeaux selon la personne à qui vous offrez, ses centres d'intérêt, sa personnalité et votre budget. Chez TheDigitalGifter, vous répondez à une courte série de questions et recevez des idées sélectionnées avec des raisons claires pour lesquelles elles pourraient convenir — vous pouvez ensuite affiner vos réponses ou enregistrer des idées dans une liste de souhaits.",
    },
    sections: [
      {
        h2: "Comment fonctionne le générateur de cadeaux de Noël",
        body:
          "Choisissez le destinataire, partagez ses centres d'intérêt et sa personnalité, fixez un budget et ajoutez éventuellement un détail personnel. Le générateur renvoie des idées de cadeaux classées avec de courtes explications. Vous pouvez ajuster vos réponses, recommencer, ou enregistrer des idées dans votre liste de souhaits de Noël.",
        list: [
          "Pour qui vous offrez",
          "Centres d'intérêt et personnalité",
          "Fourchette de budget",
          "Idées de cadeaux personnalisées avec raisons",
        ],
      },
      {
        h2: "Trouver des cadeaux par destinataire",
        body:
          "Le générateur de cadeaux prend en charge les relations d'achat courantes à Noël pour que les recommandations restent pertinentes. Utilisez l'outil pour maman, papa, épouse, mari, petite amie, petit ami, enfants, adolescents, grands-parents, amis, collègues et plus. Les pages dédiées par destinataire ne sont pas encore disponibles — lancez le générateur et choisissez le destinataire directement.",
        list: [
          "Maman",
          "Papa",
          "Épouse",
          "Mari",
          "Petite amie",
          "Petit ami",
          "Enfants",
          "Adolescents",
          "Grands-parents",
          "Amis",
          "Collègues",
        ],
      },
      {
        h2: "Trouver des cadeaux de Noël par budget",
        body:
          "Choisissez une fourchette de dépenses comme moins de 25 €, 25–50 €, 50–100 €, 100–200 €, 200 €+ ou sans budget précis. Les recommandations sont des idées de cadeaux avec des fourchettes de prix habituelles — pas d'inventaire en temps réel chez un revendeur, ni de stock garanti.",
      },
      {
        h2: "Des cadeaux pour quelqu'un qui a déjà tout",
        body:
          "Quand quelqu'un semble déjà posséder « tout », les cadeaux de Noël les plus pertinents penchent souvent vers des expériences, des souvenirs personnalisés, des améliorations liées à un hobby, des moments sentimentaux ou des articles pratiques haut de gamme. Choisir la personnalité « A déjà tout » oriente le générateur vers ces pistes plutôt que vers des objets génériques.",
      },
      {
        h2: "Enregistrez des idées dans votre liste de souhaits",
        body:
          "Une idée vous plaît ? Enregistrez-la dans votre liste de souhaits de Noël et partagez une liste unique avec la famille pour coordonner les achats.",
        linkHref: "/fr/christmas/wishlist",
        linkLabel: "Ouvrir le créateur de liste de souhaits de Noël",
      },
    ],
    faqs: [
      {
        q: "Comment fonctionne le générateur de cadeaux de Noël ?",
        a: "Vous répondez à quelques questions rapides sur la personne à qui vous offrez, ses centres d'intérêt, sa personnalité et votre budget. Vous voyez ensuite des idées de cadeaux sélectionnées avec une raison claire pour chacune.",
      },
      {
        q: "Puis-je rechercher par budget ?",
        a: "Oui. Les fourchettes de budget sont une étape centrale du générateur.",
      },
      {
        q: "Puis-je trouver des cadeaux pour quelqu'un qui a déjà tout ?",
        a: "Oui. L'option de personnalité « A déjà tout » oriente les idées vers des expériences, la personnalisation et des souvenirs sincères.",
      },
      {
        q: "Puis-je l'utiliser pour des enfants ou des adolescents ?",
        a: "Oui. Choisissez Enfant ou Adolescent (ou Fille/Fils avec une tranche d'âge) pour que les idées restent adaptées à leur âge.",
      },
      {
        q: "Puis-je enregistrer des idées dans ma liste de souhaits ?",
        a: "Oui. Utilisez « Enregistrer dans la liste de souhaits » sur une idée pour l'ajouter à /fr/christmas/wishlist.",
      },
      {
        q: "Les recommandations sont-elles vraiment personnalisées ?",
        a: "Oui. Les recommandations tiennent compte du destinataire, de l'âge, des centres d'intérêt, de la personnalité, du budget et d'un détail personnel facultatif.",
      },
      {
        q: "Affiche-t-il de vrais produits ?",
        a: "Aujourd'hui, le générateur affiche des idées de cadeaux sélectionnées avec des fourchettes de prix habituelles. Les prix en temps réel, la disponibilité et les flux boutique ne sont pas encore connectés — nous n'inventons pas de stock exact ni de prix de revendeur.",
      },
    ],
  },

  "/christmas/wishlist": {
    title: "Créateur de liste de souhaits de Noël | Créez et partagez votre liste",
    description: "Créez une liste de souhaits de Noël, ajoutez des cadeaux de n'importe où, et partagez un seul lien avec la famille et les amis.",
    h1: "Créez une liste de souhaits de Noël et partagez un seul lien",
    lede:
      "Créez en quelques minutes une liste de souhaits de Noël partageable. Ajoutez des cadeaux de n'importe quelle boutique ou écrivez vos propres souhaits, puis envoyez un seul lien à la famille et aux amis.",
    h2: "Comment ça marche",
    h2Body: "Créez votre liste, ajoutez des souhaits, partagez un lien et laissez chacun se coordonner sans gâcher la surprise.",
    links: [
      { href: "/fr/christmas/gift-finder", label: "Essayer le générateur de cadeaux de Noël" },
      { href: "/fr/christmas/tree", label: "Placer des cadeaux sous un sapin de Noël numérique" },
      { href: "/fr/christmas/photo-generator", label: "Ajouter un portrait de Noël" },
      { href: "/fr/christmas", label: "Retour à Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/wishlist", label: "Liste de souhaits" },
    ],
    geo: {
      h2: "Qu'est-ce qu'une liste de souhaits de Noël en ligne ?",
      body:
        "Une liste de souhaits de Noël en ligne est une liste partageable de cadeaux ou d'expériences que quelqu'un aimerait recevoir. Chez TheDigitalGifter, vous créez une liste, ajoutez des souhaits via des liens produits ou du texte libre, partagez un seul lien avec la famille et les amis, et laissez chacun réserver un cadeau pour que les achats restent coordonnés sans gâcher la surprise.",
    },
    sections: [
      {
        h2: "Créer une liste de souhaits de Noël en ligne",
        body:
          "Nommez votre liste, ajoutez des souhaits et gardez toutes vos idées de Noël au même endroit au lieu de disperser des liens dans plusieurs conversations. Vous pouvez démarrer rapidement et modifier votre liste à tout moment.",
      },
      {
        h2: "Ajoutez tout ce que vous souhaitez",
        body:
          "Collez un lien produit de presque n'importe quelle boutique, écrivez un souhait manuel, ajoutez des notes et incluez des expériences ou des idées faites main. Si un lien ne peut pas être lu automatiquement, vous pouvez tout de même enregistrer le souhait à la main.",
      },
      {
        h2: "Partagez un seul lien simple",
        body:
          "Activez le partage et envoyez un seul lien de liste de souhaits par copie, WhatsApp, e-mail ou le menu de partage de votre appareil. Les listes partagées sont accessibles aux personnes disposant du lien et ne sont pas destinées aux moteurs de recherche.",
      },
      {
        h2: "Évitez les cadeaux de Noël en double",
        body:
          "Les visiteurs peuvent appuyer sur « Je m'occupe de ça » pour réserver un cadeau. Les réservations restent anonymes pour la personne qui a créé la liste, préservant ainsi la surprise tandis que la famille évite d'acheter la même chose deux fois.",
      },
      {
        h2: "Listes de souhaits de Noël pour les enfants et les familles",
        body:
          "Créez une liste pour vous-même, votre enfant ou quelqu'un d'autre, puis partagez-la avec les grands-parents et les amis. Associez-la au générateur de cadeaux quand vous ne savez pas quoi demander.",
        linkHref: "/fr/christmas/gift-finder",
        linkLabel: "Essayer le générateur de cadeaux de Noël",
      },
    ],
    faqs: [
      {
        q: "Comment créer une liste de souhaits de Noël ?",
        a: "Ouvrez la page de la liste de souhaits de Noël, choisissez un titre et créez votre liste. Vous pouvez ensuite ajouter des souhaits immédiatement.",
      },
      {
        q: "Puis-je ajouter des cadeaux de n'importe quelle boutique ?",
        a: "Oui. Collez un lien produit classique, ou ajoutez le cadeau manuellement si la page ne peut pas être lue automatiquement.",
      },
      {
        q: "Puis-je ajouter des souhaits sans lien ?",
        a: "Oui. Écrivez n'importe quel souhait — des expériences, des idées faites main, ou un simple « Surprenez-moi ».",
      },
      {
        q: "Puis-je partager un seul lien de liste de souhaits ?",
        a: "Oui. Activez le partage et envoyez le lien à la famille et aux amis.",
      },
      {
        q: "Les visiteurs peuvent-ils réserver des cadeaux ?",
        a: "Oui. Les visiteurs peuvent réserver un cadeau pour que les autres sachent qu'il est déjà pris en charge.",
      },
      {
        q: "Saurai-je qui a acheté quelque chose ?",
        a: "Non. Les réservations restent anonymes pour préserver la surprise.",
      },
      {
        q: "Puis-je en créer une pour mon enfant ?",
        a: "Oui. Choisissez à qui la liste est destinée lors de sa création, puis partagez le lien avec la famille.",
      },
      {
        q: "Puis-je la modifier après l'avoir partagée ?",
        a: "Oui. Ajoutez, modifiez, réorganisez ou supprimez des souhaits à tout moment. Les personnes disposant du lien voient les mises à jour.",
      },
    ],
  },

  "/christmas/photo-generator": {
    title: "Générateur de photos de Noël par IA | Famille, couples & animaux",
    description: "Transformez votre photo préférée en un portrait de Noël magique. Créez des photos festives pour la famille, les couples et les animaux en quelques minutes.",
    h1: "Transformez votre photo en magie de Noël",
    lede:
      "Téléchargez une photo, choisissez une scène de Noël festive et créez un portrait de Noël personnalisé que vous pourrez télécharger et partager en privé.",
    h2: "Styles de photos de Noël",
    h2Body: "Créez des portraits pour la famille, les couples, les animaux, les chiens et les chats à partir d'une seule expérience de génération photo de Noël.",
    links: [
      { href: "/fr/christmas/family", label: "Portraits de Noël en famille" },
      { href: "/fr/christmas/couples", label: "Portraits de Noël en couple" },
      { href: "/fr/christmas/pets", label: "Portraits de Noël pour animaux" },
      { href: "/fr/christmas/dogs", label: "Portraits de Noël pour chiens" },
      { href: "/fr/christmas/cats", label: "Portraits de Noël pour chats" },
      { href: "/fr/christmas/cards", label: "Transformer un portrait en carte de Noël" },
      { href: "/fr/christmas", label: "Accueil Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos" },
    ],
    geo: {
      h2: "Qu'est-ce qu'un générateur de photos de Noël par IA ?",
      body:
        "Un générateur de photos de Noël par IA transforme une photo réelle que vous téléchargez en un portrait de Noël festif. Chez TheDigitalGifter, vous choisissez qui figure sur la photo, sélectionnez un style de Noël et créez un portrait téléchargeable pour une famille, un couple, une personne ou un animal — privé par défaut.",
    },
    sections: [
      {
        h2: "Transformez votre photo en portrait de Noël",
        body:
          "Téléchargez une photo préférée, choisissez le type de sujet, sélectionnez une ambiance de Noël et créez un portrait festif que vous pourrez télécharger. L'objectif est une image de fête qui garde tout de même l'apparence des personnes ou animaux que vous aimez.",
      },
      {
        h2: "Exemples de photos de Noël",
        body: "Les exemples de démonstration montrent des directions courantes de portraits de Noël. Ce sont des échantillons d'inspiration, pas des photos de clients.",
        list: [
          "Photo de Noël en famille — un portrait de groupe dans une scène chaleureuse",
          "Portrait de Noël en couple — un portrait romantique de fête pour deux personnes",
          "Portrait de Noël pour chien — un portrait festif centré sur le chien",
          "Portrait de Noël pour chat — un portrait festif centré sur le chat",
          "Famille + animal — des personnes et un animal réunis dans une même image de Noël",
        ],
      },
      {
        h2: "Styles de photos de Noël",
        body:
          "Les styles de Noël disponibles incluent Noël douillet, Merveille hivernale, Noël de luxe, Matin de Noël, Cabane enneigée, Noël classique, Noël blanc élégant et Marché de Noël. Choisissez le style qui correspond au souvenir que vous voulez créer.",
      },
      {
        h2: "Quelles photos fonctionnent le mieux ?",
        body:
          "Utilisez une photo nette avec des visages bien visibles (ou un animal bien visible), un éclairage correct et une netteté suffisante pour que tous les sujets soient reconnaissables. Évitez le flou important, les recadrages sévères ou les photos où des personnes clés sont cachées.",
      },
      {
        h2: "Photos de Noël pour familles, couples et animaux",
        body:
          "Vous cherchez un point de départ plus précis ? Utilisez les parcours dédiés pour la famille, les couples, les animaux, les chiens et les chats — ou restez ici pour le générateur complet.",
        list: [
          "Portraits de Noël en famille → /fr/christmas/family",
          "Portraits de Noël en couple → /fr/christmas/couples",
          "Portraits de Noël pour animaux → /fr/christmas/pets",
          "Portraits de Noël pour chiens → /fr/christmas/dogs",
          "Portraits de Noël pour chats → /fr/christmas/cats",
          "Transformer un portrait en carte de Noël → /fr/christmas/cards",
        ],
      },
    ],
    faqs: [
      {
        q: "Comment fonctionne le générateur de photos de Noël ?",
        a: "Téléchargez une photo, choisissez qui y figure, sélectionnez un style de Noël, puis créez votre portrait après le paiement lorsque le parcours du produit l'exige.",
      },
      {
        q: "Quelle photo devrais-je télécharger ?",
        a: "Une photo nette avec des visages visibles ou un animal bien visible fonctionne le mieux. Un bon éclairage aide. Évitez le flou important.",
      },
      {
        q: "Puis-je créer une photo de Noël en famille ?",
        a: "Oui. Choisissez « famille » comme sujet, ou commencez directement depuis la page dédiée à la famille.",
      },
      {
        q: "Puis-je créer un portrait de Noël de mon chien ou mon chat ?",
        a: "Oui. Les sujets animaux sont pris en charge, avec des parcours dédiés pour les chiens et les chats pour un démarrage plus clair.",
      },
      {
        q: "Plusieurs personnes peuvent-elles figurer sur la photo ?",
        a: "Oui pour les parcours famille et couple. Téléchargez une photo qui inclut toutes les personnes qui doivent apparaître.",
      },
      {
        q: "Puis-je essayer différents styles ?",
        a: "Oui. Choisissez parmi les styles de Noël disponibles listés sur la page avant de créer votre portrait.",
      },
      {
        q: "Puis-je télécharger le résultat ?",
        a: "Oui. Une fois votre portrait prêt, téléchargez-le depuis l'écran de résultat.",
      },
      {
        q: "Qu'advient-il de ma photo téléchargée ?",
        a: "Les téléchargements et résultats sont privés par défaut. Il n'y a pas de galerie publique. L'accès se fait via votre parcours de commande/résultat.",
      },
    ],
  },

  "/christmas/family": {
    title: "Générateur de photos de Noël en famille | Portraits de Noël familiaux",
    description:
      "Créez un portrait de Noël familial personnalisé à partir de votre photo de famille préférée. Choisissez une scène de Noël festive et transformez votre photo en souvenir.",
    h1: "Transformez votre photo de famille en un portrait de Noël magique",
    lede:
      "Créez un portrait de Noël familial personnalisé à partir de votre photo de famille préférée. Choisissez une scène de Noël festive et transformez votre photo en souvenir.",
    h2: "Plus de portraits de Noël",
    links: [
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos de Noël par IA" },
      { href: "/fr/christmas/couples", label: "Portraits de Noël en couple" },
      { href: "/fr/christmas/pets", label: "Portraits de Noël pour animaux" },
      { href: "/fr/christmas/cards", label: "Créateur de cartes de Noël" },
      { href: "/fr/christmas", label: "Accueil Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos" },
      { href: "/fr/christmas/family", label: "Famille" },
    ],
    geo: {
      h2: "Qu'est-ce qu'un générateur de photos de Noël familial ?",
      body:
        "Un générateur de photos de Noël familial transforme une photo de famille téléchargée en un portrait de groupe de Noël festif. Chez TheDigitalGifter, vous téléchargez une photo nette de votre famille, choisissez un style de Noël conçu pour plusieurs personnes et créez un portrait téléchargeable — privé par défaut, avec la possibilité de continuer vers une carte de Noël.",
    },
    sections: [
      {
        h2: "Créez un portrait de Noël en famille",
        body:
          "Cette expérience est conçue spécifiquement pour les familles — pas un look générique pour une seule personne. Téléchargez une photo de groupe, choisissez une ambiance de Noël et créez un portrait qui vise à garder tout le monde dans le cadre.",
      },
      {
        h2: "Exemples de photos de Noël en famille",
        body: "Les exemples de démonstration montrent des directions de portraits de Noël familiaux. Ce sont des échantillons d'inspiration, pas des photos de clients.",
        list: [
          "Parents avec enfants dans un salon de Noël chaleureux",
          "Famille de trois ou quatre personnes près du sapin décoré",
          "Grand rassemblement familial dans une scène festive",
          "Portraits multigénérationnels incluant les grands-parents",
          "Famille avec un animal clairement visible dans la même photo",
        ],
      },
      {
        h2: "Styles de Noël pour les familles",
        body:
          "Les styles familiaux disponibles aujourd'hui incluent Noël familial classique, Cheminée douillette, Merveille hivernale, Noël élégant, Matin de Noël, Noël de luxe, Film de Noël et Noël familial vintage.",
      },
      {
        h2: "Quelles photos de famille fonctionnent le mieux ?",
        body:
          "Utilisez une photo de groupe nette où les visages sont visibles, l'éclairage est correct et toutes les personnes que vous voulez inclure sont reconnaissables. Évitez le flou important, les recadrages sévères ou les photos où des personnes clés sont cachées.",
      },
      {
        h2: "Cartes de Noël en famille",
        body:
          "Une fois votre portrait de famille prêt, vous pouvez continuer vers le créateur de cartes de Noël et terminer avec un message.",
        linkHref: "/fr/christmas/cards",
        linkLabel: "Transformer votre portrait de famille en carte de Noël",
      },
      {
        h2: "Plus de portraits de Noël",
        body: "Vous cherchez un autre sujet ? Commencez depuis le générateur complet ou passez aux couples et aux animaux.",
        list: [
          "Générateur de photos de Noël par IA → /fr/christmas/photo-generator",
          "Portraits de Noël en couple → /fr/christmas/couples",
          "Portraits de Noël pour animaux → /fr/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Puis-je créer un portrait de Noël à partir d'une seule photo de famille ?",
        a: "Oui. Téléchargez une photo de famille nette, choisissez un style de Noël et créez votre portrait familial.",
      },
      {
        q: "Plusieurs personnes peuvent-elles figurer sur la photo ?",
        a: "Oui. Ce parcours est conçu pour les groupes. Assurez-vous que tout le monde est bien visible sur la photo d'origine.",
      },
      {
        q: "Les grands-parents peuvent-ils être inclus ?",
        a: "Oui. Les photos multigénérationnelles — incluant grands-parents et bébés — sont les bienvenues dès que les visages sont visibles.",
      },
      {
        q: "Puis-je inclure l'animal de la famille ?",
        a: "Oui, quand l'animal est clairement visible sur la photo de famille. Pour un portrait uniquement d'animal, les expériences Animaux, Chiens ou Chats conviennent mieux.",
      },
      {
        q: "Quelles photos fonctionnent le mieux ?",
        a: "Des photos nettes avec des visages bien visibles, un bon éclairage et toutes les personnes souhaitées incluses. Évitez le flou important.",
      },
      {
        q: "Puis-je essayer plusieurs styles de Noël ?",
        a: "Oui. Choisissez parmi les styles familiaux affichés sur la page, et vous pouvez essayer un autre style après avoir créé un portrait.",
      },
      {
        q: "Puis-je télécharger le portrait final ?",
        a: "Oui. Une fois votre portrait prêt, téléchargez-le depuis l'écran de résultat.",
      },
      {
        q: "Puis-je l'utiliser dans une carte de Noël ?",
        a: "Oui. Le transfert du portrait vers le créateur de cartes de Noël est pris en charge.",
      },
    ],
  },

  "/christmas/couples": {
    title: "Générateur de photos de Noël en couple | Portraits de Noël romantiques",
    description: "Créez un portrait de Noël romantique en couple à partir de votre photo. Idéal pour un premier Noël ensemble ou un cadeau personnalisé à deux.",
    h1: "Créez ensemble un portrait de Noël magique",
    lede: "Téléchargez une photo de vous deux et créez un portrait de Noël romantique en couple — privé par défaut.",
    h2: "Plus de portraits de Noël",
    links: [
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos de Noël par IA" },
      { href: "/fr/christmas/family", label: "Portraits de Noël en famille" },
      { href: "/fr/christmas/pets", label: "Portraits de Noël pour animaux" },
      { href: "/fr/christmas", label: "Accueil Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos" },
      { href: "/fr/christmas/couples", label: "Couples" },
    ],
    geo: {
      h2: "Qu'est-ce qu'un générateur de photos de Noël en couple ?",
      body:
        "Un générateur de photos de Noël en couple transforme une photo de deux personnes en un portrait de Noël romantique ou chaleureux. Chez TheDigitalGifter, vous téléchargez une photo qui vous inclut tous les deux, choisissez un style de Noël pour couples et créez un portrait téléchargeable à partager en privé ou à utiliser dans une carte de Noël.",
    },
    sections: [
      {
        h2: "Créez un portrait de Noël à deux",
        body:
          "Cette expérience est conçue pour deux personnes — partenaires, fiancés, mari et femme, ou petit ami et petite amie. Téléchargez une photo où vous êtes tous les deux bien visibles, choisissez une ambiance de Noël et créez un portrait pensé pour vous deux.",
      },
      {
        h2: "Idées de photos de Noël en couple",
        body: "Cas d'usage auxquels ce portrait correspond souvent — à titre d'inspiration, pas de modes de produit distincts :",
        list: [
          "Premier Noël ensemble",
          "Portrait de Noël pour couple fiancé",
          "Portrait de Noël pour mari et femme",
          "Photo de Noël pour petit ami et petite amie",
          "Surprise de Noël à distance à partager numériquement",
          "Photo de carte de Noël en couple",
        ],
      },
      {
        h2: "Styles de Noël romantiques",
        body:
          "Les styles de couple disponibles aujourd'hui incluent Chute de neige romantique, Cheminée douillette, Film de Noël, Noël élégant, Ville hivernale, Marché de Noël, Portrait classique et Noël vintage.",
      },
      {
        h2: "Quelles photos de couple fonctionnent le mieux ?",
        body:
          "Utilisez une photo nette où les deux visages sont visibles et où aucune des deux personnes n'est fortement recadrée. Un bon éclairage aide. Les selfies peuvent fonctionner si les deux personnes sont reconnaissables.",
      },
      {
        h2: "Transformez-le en carte de Noël",
        body: "Une fois votre portrait de couple créé, vous pouvez le transférer vers le créateur de cartes de Noël.",
        linkHref: "/fr/christmas/cards",
        linkLabel: "Transformer votre portrait de couple en carte de Noël",
      },
      {
        h2: "Portraits de Noël associés",
        body: "Besoin d'un portrait de famille ou d'animal à la place ?",
        list: [
          "Portraits de Noël en famille → /fr/christmas/family",
          "Générateur de photos de Noël par IA → /fr/christmas/photo-generator",
          "Portraits de Noël pour animaux → /fr/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Puis-je utiliser un selfie ?",
        a: "Oui, lorsque les deux personnes sont clairement visibles et reconnaissables sur la même photo.",
      },
      {
        q: "Les deux personnes resteront-elles reconnaissables ?",
        a: "C'est l'objectif. Commencez avec une photo nette des deux visages — évitez le flou important ou une personne largement hors cadre.",
      },
      {
        q: "Puis-je créer un portrait de Noël romantique ?",
        a: "Oui. Choisissez des styles de couple romantiques ou chaleureux comme Chute de neige romantique, Cheminée douillette ou Noël élégant.",
      },
      {
        q: "Puis-je essayer différents styles ?",
        a: "Oui. Choisissez parmi les styles de couple disponibles sur la page avant de créer votre portrait.",
      },
      {
        q: "Puis-je utiliser le résultat comme carte de Noël ?",
        a: "Oui. Le transfert du portrait vers le créateur de cartes de Noël est pris en charge.",
      },
      {
        q: "Puis-je le télécharger ?",
        a: "Oui. Téléchargez le portrait de couple terminé depuis l'écran de résultat une fois prêt.",
      },
      {
        q: "Quel type de photo devrais-je télécharger ?",
        a: "Une photo nette qui vous inclut tous les deux. Les visages doivent être visibles ; JPEG, PNG ou WebP fonctionnent.",
      },
    ],
  },

  "/christmas/pets": {
    title: "Générateur de photos de Noël pour animaux | Portraits festifs pour animaux",
    description: "Transformez la photo de votre animal en un portrait de Noël festif. Chiens et chats bienvenus — privé par défaut.",
    h1: "Transformez votre animal en magie de Noël",
    lede: "Téléchargez une photo nette de votre animal et créez un portrait de Noël festif pour chiens ou chats.",
    h2: "Portraits de Noël par espèce",
    links: [
      { href: "/fr/christmas/dogs", label: "Portraits de Noël pour chiens" },
      { href: "/fr/christmas/cats", label: "Portraits de Noël pour chats" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos de Noël par IA" },
      { href: "/fr/christmas", label: "Accueil Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos" },
      { href: "/fr/christmas/pets", label: "Animaux" },
    ],
    geo: {
      h2: "Qu'est-ce qu'un générateur de photos de Noël pour animaux ?",
      body:
        "Un générateur de photos de Noël pour animaux transforme la photo d'un chien, d'un chat ou d'un autre animal en un portrait de Noël festif. Chez TheDigitalGifter, la page Animaux est le point central pour les portraits animaliers de Noël, avec des parcours spécialisés pour les chiens et les chats, des résultats téléchargeables et un transfert facultatif vers une carte de Noël.",
    },
    sections: [
      {
        h2: "Transformez votre animal en magie de Noël",
        body:
          "Téléchargez une photo nette de votre animal, choisissez un style de Noël pour animaux et créez un portrait festif de l'animal que vous aimez. Ceci est le point central général pour les animaux — pas une collection de type bande dessinée spécifique.",
      },
      {
        h2: "Portraits de Noël pour chiens et chats",
        body:
          "Vous voulez un démarrage plus précis pour une espèce ? Utilisez les parcours spécialisés pour chien ou chat — ils aident à valider la photo et gardent l'expérience centrée sur le chien ou le chat.",
        list: [
          "Générateur de photos de Noël pour chiens → /fr/christmas/dogs",
          "Générateur de photos de Noël pour chats → /fr/christmas/cats",
        ],
      },
      {
        h2: "Exemples de photos de Noël pour animaux",
        body: "Directions de démonstration pour les portraits de Noël d'animaux. Les échantillons sont une inspiration, pas des photos de clients.",
        list: [
          "Portrait de Noël pour chien dans une scène festive",
          "Portrait de Noël pour chat près d'un sapin ou d'une cheminée",
          "Styles de portrait animal douillet façon pull ou inspiré du Père Noël",
        ],
      },
      {
        h2: "Styles de Noël pour animaux",
        body:
          "Les styles pour animaux disponibles aujourd'hui incluent Animal du Père Noël, Noël douillet, Pôle Nord, Pull de Noël, Portrait sous la neige, Carte de Noël, Noël royal et Noël vintage.",
      },
      {
        h2: "Quelles photos d'animaux fonctionnent le mieux ?",
        body:
          "Choisissez une photo nette où le visage et les yeux de l'animal sont visibles, avec un éclairage correct et sans flou important. Si plusieurs animaux doivent apparaître, assurez-vous que chacun est visible sur la photo.",
      },
      {
        h2: "Cartes de Noël pour animaux",
        body: "Vous pouvez transférer un portrait d'animal terminé vers le créateur de cartes de Noël.",
        linkHref: "/fr/christmas/cards",
        linkLabel: "Transformer votre portrait d'animal en carte de Noël",
      },
    ],
    faqs: [
      {
        q: "Puis-je créer un portrait de Noël de mon chien ?",
        a: "Oui. Commencez ici ou allez sur la page dédiée au portrait de Noël pour chien pour un parcours centré sur le chien.",
      },
      {
        q: "Puis-je en créer un pour mon chat ?",
        a: "Oui. Utilisez cette page Animaux ou la page dédiée au portrait de Noël pour chat.",
      },
      {
        q: "Puis-je inclure plus d'un animal ?",
        a: "Si plusieurs animaux sont clairement visibles sur une même photo, vous pouvez essayer ce téléchargement. Les résultats sont meilleurs quand le visage de chaque animal est bien visible.",
      },
      {
        q: "Puis-je m'inclure avec mon animal ?",
        a: "Ce parcours est optimisé pour que l'animal soit la vedette. Pour des photos de famille avec personnes et animal, l'expérience Famille de Noël est souvent un meilleur point de départ.",
      },
      {
        q: "Quelles photos fonctionnent le mieux ?",
        a: "Des photos nettes d'animaux avec les yeux et le visage visibles, un bon éclairage et un flou limité.",
      },
      {
        q: "Puis-je télécharger l'image ?",
        a: "Oui. Téléchargez-la depuis l'écran de résultat une fois votre portrait d'animal prêt.",
      },
      {
        q: "Puis-je l'utiliser sur une carte de Noël ?",
        a: "Oui. Le transfert du portrait vers le créateur de cartes de Noël est pris en charge.",
      },
    ],
  },

  "/christmas/dogs": {
    title: "Générateur de photos de Noël pour chiens | Portraits festifs pour chiens",
    description: "Créez un portrait de Noël magique de votre chien à partir d'une photo nette. Vérification de l'espèce et confidentialité par défaut.",
    h1: "Créez un portrait de Noël magique de votre chien",
    lede: "Téléchargez une photo nette de votre chien, choisissez un style de fête et créez un portrait de Noël pour chien.",
    h2: "Portraits d'animaux associés",
    links: [
      { href: "/fr/christmas/cats", label: "Portraits de Noël pour chats" },
      { href: "/fr/christmas/pets", label: "Tous les portraits de Noël pour animaux" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos de Noël par IA" },
      { href: "/fr/christmas", label: "Accueil Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos" },
      { href: "/fr/christmas/pets", label: "Animaux" },
      { href: "/fr/christmas/dogs", label: "Chiens" },
    ],
    geo: {
      h2: "Qu'est-ce qu'un générateur de photos de Noël pour chiens ?",
      body:
        "Un générateur de photos de Noël pour chiens crée un portrait de Noël festif à partir d'une photo de votre chien. Chez TheDigitalGifter, vous téléchargez une photo nette de votre chien, choisissez un style animal de Noël et téléchargez un portrait de fête centré sur le chien — avec un parcours facultatif vers une carte de Noël.",
    },
    sections: [
      {
        h2: "Créez un portrait de Noël de votre chien",
        body:
          "Cette page est spécifique aux chiens. Téléchargez une photo de votre chien, choisissez un style de Noël et créez un portrait de fête qui garde le chien comme sujet clair. Si la photo ressemble à un chat, vous serez guidé vers l'expérience dédiée aux chats.",
      },
      {
        h2: "Exemples de portraits de Noël pour chiens",
        body: "Directions de démonstration pour les portraits de Noël de chiens — échantillons d'inspiration, pas des photos de clients.",
        list: [
          "Chien près d'un sapin de Noël décoré",
          "Portrait de Noël chaleureux près de la cheminée avec un chien",
          "Portrait de Noël enneigé avec un chien",
          "Style inspiré du Père Noël ou pull de Noël pour chien",
        ],
      },
      {
        h2: "Styles de Noël pour chiens",
        body:
          "Les portraits de chiens utilisent l'ensemble de styles animaux de Noël : Animal du Père Noël, Noël douillet, Pôle Nord, Pull de Noël, Portrait sous la neige, Carte de Noël, Noël royal et Noël vintage.",
      },
      {
        h2: "Comment choisir une bonne photo de chien",
        body:
          "Choisissez une photo où les yeux et le visage de votre chien sont visibles, la tête n'est pas trop recadrée, et le flou est minimal. Pour plusieurs chiens, assurez-vous que chaque chien souhaité est clairement dans le cadre.",
      },
      {
        h2: "Cartes de Noël avec votre chien",
        body: "Les portraits de chiens terminés peuvent être transférés vers le créateur de cartes de Noël.",
        linkHref: "/fr/christmas/cards",
        linkLabel: "Créer une carte de Noël avec le portrait de votre chien",
      },
      {
        h2: "Portraits de Noël pour animaux associés",
        body: "Vous explorez d'autres animaux ou la page générale pour animaux ?",
        list: [
          "Portraits de Noël pour animaux → /fr/christmas/pets",
          "Générateur de photos de Noël pour chats → /fr/christmas/cats",
          "Générateur de photos de Noël par IA → /fr/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Puis-je créer un portrait de Noël de mon chien ?",
        a: "Oui. Téléchargez une photo nette de votre chien sur cette page, choisissez un style de Noël et créez le portrait.",
      },
      {
        q: "Que se passe-t-il si je télécharge par erreur une photo de chat ?",
        a: "Vous serez invité à passer à l'expérience de portrait de Noël pour chats.",
      },
      {
        q: "Puis-je inclure plus d'un chien ?",
        a: "Oui, si chaque chien est clairement visible sur la même photo. Les visages et les yeux doivent être bien visibles.",
      },
      {
        q: "Quelles photos de chien fonctionnent le mieux ?",
        a: "Visage et yeux bien visibles, flou limité, en évitant de recadrer les oreilles ou la tête.",
      },
      {
        q: "Puis-je essayer différents styles de Noël pour mon chien ?",
        a: "Oui. Choisissez parmi les styles animaux de Noël adaptés aux chiens listés sur la page.",
      },
      {
        q: "Puis-je télécharger le portrait du chien ?",
        a: "Oui. Téléchargez-le depuis l'écran de résultat une fois prêt.",
      },
      {
        q: "Puis-je mettre mon chien sur une carte de Noël ?",
        a: "Oui. Utilisez le transfert vers le créateur de cartes de Noël une fois votre portrait prêt.",
      },
    ],
  },

  "/christmas/cats": {
    title: "Générateur de photos de Noël pour chats | Portraits festifs pour chats",
    description: "Créez un portrait de Noël magique de votre chat à partir d'une photo nette. Vérification de l'espèce et confidentialité par défaut.",
    h1: "Créez un portrait de Noël magique de votre chat",
    lede: "Téléchargez une photo nette de votre chat, choisissez un style de fête et créez un portrait de Noël pour chat.",
    h2: "Portraits d'animaux associés",
    links: [
      { href: "/fr/christmas/dogs", label: "Portraits de Noël pour chiens" },
      { href: "/fr/christmas/pets", label: "Tous les portraits de Noël pour animaux" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos de Noël par IA" },
      { href: "/fr/christmas", label: "Accueil Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos" },
      { href: "/fr/christmas/pets", label: "Animaux" },
      { href: "/fr/christmas/cats", label: "Chats" },
    ],
    geo: {
      h2: "Qu'est-ce qu'un générateur de photos de Noël pour chats ?",
      body:
        "Un générateur de photos de Noël pour chats crée un portrait de Noël festif à partir d'une photo de votre chat. Chez TheDigitalGifter, vous téléchargez une photo nette de votre chat, choisissez un style animal de Noël et téléchargez un portrait de fête centré sur le chat, que vous pouvez aussi utiliser dans une carte de Noël.",
    },
    sections: [
      {
        h2: "Créez un portrait de Noël magique de votre chat",
        body:
          "Cette page est spécifique aux chats. Téléchargez une photo de votre chat, choisissez une ambiance de Noël et créez un portrait de fête avec le chat comme vedette. Les photos de chien sont redirigées vers l'expérience dédiée aux chiens.",
      },
      {
        h2: "Exemples de portraits de Noël pour chats",
        body: "Directions de démonstration mettant en scène des chats — échantillons d'inspiration, pas des photos de clients.",
        list: [
          "Chat près d'un sapin de Noël",
          "Portrait de Noël chaleureux près de la cheminée avec un chat",
          "Portrait de Noël enneigé ou élégant avec un chat",
          "Styles de Noël royal ou vintage pour chat",
        ],
      },
      {
        h2: "Styles de Noël pour chats",
        body:
          "Les portraits de chats utilisent l'ensemble de styles animaux de Noël : Animal du Père Noël, Noël douillet, Pôle Nord, Pull de Noël, Portrait sous la neige, Carte de Noël, Noël royal et Noël vintage.",
      },
      {
        h2: "Comment choisir une bonne photo de chat",
        body:
          "Choisissez une photo où les yeux et le visage de votre chat sont nets et visibles. Évitez le flou important, les ombres marquées sur le visage ou les recadrages serrés qui coupent les oreilles et les moustaches.",
      },
      {
        h2: "Transformez le portrait de votre chat en carte de Noël",
        body: "Après avoir créé un portrait de Noël pour chat, vous pouvez continuer vers le créateur de cartes de Noël.",
        linkHref: "/fr/christmas/cards",
        linkLabel: "Créer une carte de Noël avec le portrait de votre chat",
      },
      {
        h2: "Portraits de Noël pour animaux associés",
        body: "Besoin des chiens ou de la page générale pour animaux à la place ?",
        list: [
          "Portraits de Noël pour animaux → /fr/christmas/pets",
          "Générateur de photos de Noël pour chiens → /fr/christmas/dogs",
          "Générateur de photos de Noël par IA → /fr/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Puis-je créer un portrait de Noël de mon chat ?",
        a: "Oui. Téléchargez une photo nette de votre chat ici, choisissez un style de Noël et créez le portrait.",
      },
      {
        q: "Que se passe-t-il si je télécharge une photo de chien ?",
        a: "Vous serez guidé pour passer à la page de portrait de Noël pour chien.",
      },
      {
        q: "Les moustaches et les détails du visage comptent-ils ?",
        a: "Oui. Un visage net avec de bons détails sur les yeux donne généralement un portrait de Noël pour chat plus réussi.",
      },
      {
        q: "Puis-je essayer des looks élégants ou douillets pour mon chat ?",
        a: "Oui. Les styles incluent Noël douillet, Noël royal, Noël vintage, Portrait sous la neige, et plus.",
      },
      {
        q: "Puis-je télécharger le portrait du chat ?",
        a: "Oui. Téléchargez-le depuis l'écran de résultat une fois prêt.",
      },
      {
        q: "Puis-je utiliser le portrait de mon chat sur une carte de Noël ?",
        a: "Oui. Le transfert vers le créateur de cartes est pris en charge après la création du portrait.",
      },
      {
        q: "Est-ce différent de la page Animaux ?",
        a: "Oui. Animaux est le point central général pour les animaux ; cette page est spécifiquement pour les chats.",
      },
    ],
  },

  "/christmas/santa-video": {
    title: "Vidéo personnalisée du Père Noël | Le Père Noël dit le prénom de votre enfant",
    description:
      "Créez une vidéo de Noël personnalisée du Père Noël qui peut inclure le prénom du destinataire et d'autres détails personnels pris en charge.",
    h1: "Créez une vidéo personnalisée du Père Noël",
    lede:
      "Créez une vidéo de Noël personnalisée du Père Noël qui peut inclure le prénom du destinataire et d'autres détails personnels pris en charge.",
    h2: "Comment fonctionnent les vidéos du Père Noël",
    h2Body: "Indiquez au Père Noël pour qui c'est, ajoutez quelques détails, puis créez une vidéo de message de Noël personnalisée.",
    links: [
      { href: "/fr/christmas/family", label: "Portraits de Noël en famille" },
      { href: "/fr/christmas/cards", label: "Créateur de cartes de Noël" },
      { href: "/fr/christmas/photo-generator", label: "Créer un portrait de Noël" },
      { href: "/fr/christmas", label: "Accueil Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/santa-video", label: "Vidéo du Père Noël" },
    ],
    geo: {
      h2: "Qu'est-ce qu'une vidéo personnalisée du Père Noël ?",
      body:
        "Une vidéo personnalisée du Père Noël est un message vidéo de Noël qui peut inclure le prénom du destinataire et d'autres détails que vous fournissez. Chez TheDigitalGifter, vous remplissez un formulaire guidé, relisez le message, puis créez une vidéo que vous pouvez télécharger et partager. La personnalisation par le prénom fonctionne indépendamment de la langue parlée — les vidéos avec voix sont actuellement disponibles en anglais et en roumain.",
    },
    sections: [
      {
        h2: "Un message personnalisé du Père Noël",
        body:
          "Créez une vidéo de Noël du Père Noël pour un enfant, des frères et sœurs, la famille ou une personne spéciale. Le Père Noël peut dire son prénom et intégrer des détails facultatifs que vous partagez — puis vous téléchargez ou partagez la vidéo terminée.",
      },
      {
        h2: "Que peut mentionner le Père Noël ?",
        body:
          "Vous pouvez personnaliser avec le prénom du destinataire, un âge facultatif, quelque chose qu'il a bien fait, un souhait de Noël, un détail supplémentaire (comme un animal ou un hobby) et la langue du Père Noël. Les vidéos avec voix sont actuellement proposées en anglais et en roumain — la personnalisation par le prénom, elle, fonctionne indépendamment de cela.",
        list: [
          "Prénom du destinataire",
          "Âge facultatif",
          "Quelque chose qu'il a bien fait",
          "Souhait de Noël",
          "Détail personnel supplémentaire",
          "Langue parlée : anglais ou roumain",
        ],
      },
      {
        h2: "Exemples de vidéos personnalisées du Père Noël",
        body:
          "Les exemples de démonstration montrent à quoi peut ressembler un message personnalisé du Père Noël. Ce sont des démonstrations produit à titre d'inspiration, pas des témoignages clients.",
      },
      {
        h2: "Comment ça marche",
        body:
          "Parlez au Père Noël de la personne concernée, ajoutez les détails que vous souhaitez mentionner, relisez l'aperçu du message, créez la vidéo, puis téléchargez-la ou partagez-la une fois prête.",
        list: ["Parlez au Père Noël de la personne", "Relisez le message", "Créez la vidéo", "Téléchargez ou partagez"],
      },
      {
        h2: "Plus de magie de Noël",
        body: "Après la vidéo du Père Noël, de nombreuses familles créent aussi un portrait ou une carte de Noël pour la même personne.",
        linkHref: "/fr/christmas",
        linkLabel: "Retour à Noël chez TheDigitalGifter",
      },
    ],
    faqs: [
      {
        q: "Le Père Noël peut-il dire le prénom de mon enfant ?",
        a: "Oui. Le prénom du destinataire est un champ de personnalisation central, et le Père Noël le prononce dans la vidéo.",
      },
      {
        q: "Une vidéo du Père Noël parlée en français est-elle disponible ?",
        a: "Pas encore. La personnalisation par le prénom fonctionne indépendamment de la langue parlée, mais les vidéos avec voix sont actuellement proposées en anglais et en roumain. Le français n'est pas encore disponible.",
      },
      {
        q: "Que puis-je personnaliser ?",
        a: "Le prénom, un âge facultatif, quelque chose que la personne a bien fait, un souhait de Noël, un détail supplémentaire et la langue parlée (anglais ou roumain).",
      },
      {
        q: "Le Père Noël peut-il mentionner un cadeau de Noël ?",
        a: "Oui — vous pouvez indiquer un souhait de Noël, que le Père Noël peut mentionner si vous en fournissez un.",
      },
      {
        q: "Puis-je créer une vidéo pour des frères et sœurs ?",
        a: "Oui. Choisissez l'option frères et sœurs et incluez leurs prénoms à l'étape du prénom. Un parcours dédié à plusieurs enfants pourrait être développé plus tard.",
      },
      {
        q: "Puis-je prévisualiser le message avant ?",
        a: "Oui. Vous pouvez relire le message avant de créer la vidéo.",
      },
      {
        q: "Puis-je télécharger ou partager la vidéo ?",
        a: "Oui. Une fois la vidéo prête, vous pouvez télécharger le fichier MP4 et le partager.",
      },
    ],
  },

  "/christmas/tree": {
    title: "Sapin de Noël numérique | Cadeaux, messages et souvenirs",
    description: "Créez un sapin de Noël numérique rempli de cadeaux, de messages et de souvenirs que vous pouvez décorer et partager en toute sécurité.",
    h1: "Construisez un sapin de Noël rempli de surprises",
    lede: "Créez, décorez et partagez un sapin de Noël numérique personnalisé avec des cadeaux et des messages en dessous.",
    h2: "Associez-le à des cadeaux de Noël",
    links: [
      { href: "/fr/christmas/wishlist", label: "Créateur de liste de souhaits de Noël" },
      { href: "/fr/christmas/gift-finder", label: "Générateur de cadeaux de Noël" },
      { href: "/fr/christmas/messages", label: "Générateur de messages de Noël" },
      { href: "/fr/christmas", label: "Accueil Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/tree", label: "Sapin numérique" },
    ],
    geo: {
      h2: "Qu'est-ce qu'un sapin de Noël numérique ?",
      body:
        "Un sapin de Noël numérique est un sapin interactif en ligne que vous pouvez personnaliser et partager. Chez TheDigitalGifter, vous choisissez un style de sapin, ajoutez des décorations, placez des boîtes-cadeaux avec des messages personnels en dessous, et partagez un lien privé pour qu'une personne spéciale puisse ouvrir les cadeaux sur son écran — sans transformer la page de partage en résultat public dans les moteurs de recherche.",
    },
    sections: [
      {
        h2: "Créez un sapin de Noël numérique",
        body:
          "Créez gratuitement un sapin de Noël interactif dans votre navigateur. Personnalisez le style (Classique, Enneigé, Doré, Douillet, Minimal ou Magique), les lumières, la neige, les cimes et les décorations, puis placez des boîtes-cadeaux en dessous.",
      },
      {
        h2: "Que pouvez-vous mettre sous votre sapin ?",
        body:
          "Aujourd'hui, vous pouvez ajouter des boîtes-cadeaux contenant des messages de Noël personnels. Chaque cadeau peut utiliser un style de boîte festif comme rouge, doré, vert, bleu ou neige. D'autres types de cadeaux pourraient être ajoutés plus tard — le créateur actuel se concentre sur les cadeaux-messages.",
        list: ["Messages de Noël personnels dans des boîtes-cadeaux", "Styles de boîtes festifs (rouge, doré, vert, bleu, neige)"],
      },
      {
        h2: "Partagez votre sapin de Noël",
        body:
          "Quand vous êtes prêt, activez le partage et envoyez un seul lien. Les destinataires ouvrent le sapin pour voir les décorations et déballer les cadeaux. Les liens de sapin partagés sont destinés aux personnes de confiance et ne sont pas indexés par les moteurs de recherche.",
      },
      {
        h2: "Un cadeau de Noël fait pour être ouvert",
        body: "Les destinataires peuvent appuyer sur les cadeaux sous le sapin pour révéler les messages que vous avez laissés — un moment numérique qui doit ressembler à l'ouverture de quelque chose placé là spécialement pour eux.",
      },
      {
        h2: "Comment ça marche",
        body: "Un chemin simple, du sapin vide à une surprise de Noël partageable.",
        list: [
          "Créez et personnalisez votre sapin de Noël numérique",
          "Ajoutez des boîtes-cadeaux avec des messages",
          "Activez le partage et envoyez le lien",
          "Ils ouvrent les cadeaux sous le sapin",
        ],
      },
      {
        h2: "Plus de magie de Noël",
        body: "Associez votre sapin à d'autres créations de Noël quand vous voulez quelque chose en plus dans l'ambiance des fêtes.",
        list: [
          "Accueil Noël → /fr/christmas",
          "Vidéo personnalisée du Père Noël → /fr/christmas/santa-video",
          "Calendrier de l'Avent en ligne → /fr/christmas/advent",
        ],
      },
    ],
    faqs: [
      {
        q: "Qu'est-ce qu'un sapin de Noël numérique ?",
        a: "Un sapin de Noël interactif en ligne que vous personnalisez, remplissez de cadeaux-messages et partagez pour que quelqu'un puisse les ouvrir sur son appareil.",
      },
      {
        q: "Qu'est-ce que je peux y ajouter ?",
        a: "Aujourd'hui, vous pouvez ajouter des boîtes-cadeaux avec des messages de Noël personnels et choisir des styles de boîtes festifs.",
      },
      {
        q: "Puis-je le partager avec quelqu'un ?",
        a: "Oui. Activez le partage et envoyez le lien. Traitez-le comme un lien de cadeau personnel.",
      },
      {
        q: "Les destinataires peuvent-ils ouvrir les cadeaux ?",
        a: "Oui. Les destinataires peuvent appuyer sur les cadeaux sous le sapin pour révéler les messages que vous avez ajoutés.",
      },
      {
        q: "Puis-je ajouter une vidéo du Père Noël ou une photo de Noël sous le sapin ?",
        a: "Pas comme type de cadeau dédié dans le créateur actuel. Vous pouvez tout de même créer ces expériences séparément et les mentionner dans un cadeau-message.",
      },
      {
        q: "Ai-je besoin d'un compte ?",
        a: "Vous pouvez commencer à créer un sapin sans configuration complexe — la propriété est gérée via la session de création pour que vous puissiez continuer à modifier.",
      },
      {
        q: "Le sapin partagé est-il public ?",
        a: "Les sapins partagés sont accessibles aux personnes disposant du lien, mais les pages de partage sont en noindex et ne sont pas destinées aux moteurs de recherche.",
      },
    ],
  },

  "/christmas/advent": {
    title: "Calendrier de l'Avent de Noël en ligne | Une surprise chaque jour",
    description: "Ouvrez une nouvelle surprise de Noël numérique chaque jour du 1er au 24 décembre.",
    h1: "Un peu de magie de Noël chaque jour",
    lede: "Ouvrez une nouvelle surprise de Noël numérique chaque jour du 1er au 24 décembre.",
    h2: "Plus de magie de Noël",
    links: [
      { href: "/fr/christmas/santa-video", label: "Vidéo personnalisée du Père Noël" },
      { href: "/fr/christmas/cards", label: "Créateur de cartes de Noël" },
      { href: "/fr/christmas/wishlist", label: "Liste de souhaits de Noël" },
      { href: "/fr/christmas", label: "Accueil Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/advent", label: "Calendrier de l'Avent" },
    ],
    geo: {
      h2: "Qu'est-ce qu'un calendrier de l'Avent en ligne ?",
      body:
        "Un calendrier de l'Avent en ligne est la version numérique du calendrier de l'Avent traditionnel : une nouvelle case se débloque chaque jour de décembre jusqu'à Noël. Chez TheDigitalGifter, vous ouvrez la case du jour sur un calendrier 1–24 (heure Europe/Bucharest). Les cases passées restent fermées après leur jour, et certaines récompenses peuvent nécessiter une connexion lorsque les tirages sont actifs.",
    },
    sections: [
      {
        h2: "Un peu de magie de Noël chaque jour",
        body:
          "Le calendrier de l'Avent est une expérience de compte à rebours avec vingt-quatre cases. Chaque jour de décembre a sa propre case — un petit rituel qui consiste à ouvrir chaque jour quelque chose de nouveau à mesure que Noël approche.",
      },
      {
        h2: "Ouvrez une nouvelle case chaque jour",
        body:
          "Les cases suivent le jour du calendrier dans le fuseau horaire Europe/Bucharest. Seule la case du jour est disponible. Les cases futures restent verrouillées. Les jours manqués ne se rattrapent pas.",
      },
      {
        h2: "Que peut-il y avoir derrière les cases ?",
        body:
          "Les récompenses des cases sont des moments de Noël configurés pour la saison — comme une surprise à réclamer lorsque les tirages en production sont actifs. La disponibilité peut dépendre des paramètres de saison et de votre connexion.",
      },
      {
        h2: "Avant le 1er décembre",
        body: "Avant le début de la fenêtre de l'Avent, les cases s'affichent comme « bientôt disponibles ». Revenez au début de décembre pour ouvrir le premier jour.",
      },
      {
        h2: "Comment fonctionne le calendrier de l'Avent",
        body: "Étapes simples pour l'expérience numérique de l'Avent.",
        list: [
          "Ouvrez la page du calendrier de l'Avent",
          "Trouvez la case du jour (1–24 en décembre)",
          "Ouvrez-la quand elle est disponible",
          "Connectez-vous si une récompense nécessite un compte",
        ],
      },
      {
        h2: "Plus de magie de Noël",
        body: "Continuez la saison avec un sapin numérique ou l'accueil de Noël.",
        list: ["Sapin de Noël numérique → /fr/christmas/tree", "Accueil Noël → /fr/christmas"],
      },
    ],
    faqs: [
      {
        q: "Quand commence le calendrier de l'Avent ?",
        a: "Les cases correspondent aux jours de décembre 1 à 24. Avant le 1er décembre, les cases s'affichent comme « bientôt disponibles ».",
      },
      {
        q: "Quand chaque case se débloque-t-elle ?",
        a: "Chaque case se débloque à son jour de calendrier dans le fuseau horaire Europe/Bucharest.",
      },
      {
        q: "Puis-je ouvrir des cases précédentes ?",
        a: "Non. Les jours manqués restent fermés — seule la case du jour est disponible.",
      },
      {
        q: "Le calendrier est-il gratuit ?",
        a: "Parcourir l'expérience du calendrier est gratuit. Certaines récompenses peuvent nécessiter un compte lorsque les tirages sont actifs pour la saison.",
      },
      {
        q: "Que puis-je trouver derrière une case ?",
        a: "Des surprises de Noël saisonnières configurées pour ce jour lorsque les tirages sont actifs — pas de garantie de prix en argent ou de crédits boutique chaque jour.",
      },
      {
        q: "Ai-je besoin d'un compte ?",
        a: "Vous pouvez consulter le calendrier sans compte. Réclamer certaines récompenses de case peut nécessiter une connexion.",
      },
      {
        q: "Puis-je l'utiliser sur mobile ?",
        a: "Oui. Le calendrier de l'Avent est conçu pour fonctionner aussi bien sur téléphone que sur ordinateur.",
      },
      {
        q: "Puis-je le partager ?",
        a: "Vous pouvez partager le lien de la page du calendrier de l'Avent pour que d'autres ouvrent leurs propres cases quotidiennes.",
      },
    ],
  },

  "/christmas/cards": {
    title: "Créateur de cartes de Noël | Cartes de Noël personnalisées",
    description: "Créez une carte de Noël personnalisée qu'ils garderont précieusement — choisissez un design, ajoutez votre message, et partagez ou téléchargez.",
    h1: "Créez une carte de Noël qu'ils garderont précieusement",
    lede: "Concevez une carte de Noël personnalisée avec des mises en page festives et votre propre message. Certains messages méritent plus qu'un simple texto.",
    h2: "Associez-la à des messages de Noël",
    links: [
      { href: "/fr/christmas/messages", label: "Générateur de messages de Noël" },
      { href: "/fr/christmas/photo-generator", label: "Générateur de photos de Noël" },
      { href: "/fr/christmas/family", label: "Portraits de Noël en famille" },
      { href: "/fr/christmas", label: "Accueil Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/cards", label: "Cartes" },
    ],
    geo: {
      h2: "Qu'est-ce qu'un créateur de cartes de Noël en ligne ?",
      body:
        "Un créateur de cartes de Noël en ligne vous permet de créer une carte de Noël personnalisée avec une photo, un design festif et votre propre message. Chez TheDigitalGifter, vous pouvez télécharger une photo ou utiliser un portrait de Noël, choisir un style, écrire ou obtenir de l'aide pour le message, puis télécharger un PNG ou partager la carte numériquement.",
    },
    sections: [
      {
        h2: "Créez une carte de Noël personnalisée",
        body:
          "Choisissez un style de carte de Noël, ajoutez votre photo, écrivez un message et créez une carte numérique que vous pourrez télécharger ou partager. Certains messages méritent plus qu'un simple texto — c'est fait pour ça.",
      },
      {
        h2: "Exemples de cartes de Noël",
        body:
          "Explorez des directions comme famille, couple, animal, élégant, drôle et classique. Les exemples sont une inspiration de design pour les styles disponibles dans le créateur.",
        list: ["Famille", "Couple", "Animal", "Élégant", "Drôle", "Classique"],
      },
      {
        h2: "Utilisez votre portrait de Noël",
        body:
          "Si vous avez déjà créé un portrait de Noël, vous pouvez l'intégrer dans le créateur de cartes et terminer avec un message. Le transfert de portrait depuis le générateur de photos de Noël est pris en charge.",
        linkHref: "/fr/christmas/photo-generator",
        linkLabel: "Créer d'abord un portrait de Noël",
      },
      {
        h2: "Messages pour cartes de Noël",
        body:
          "Écrivez vos propres mots, ou utilisez l'aide intégrée aux messages comme point de départ — elle prend en charge l'anglais et le roumain aujourd'hui. Pour des voeux plus élaborés, le générateur de messages de Noël explique le concept que vous pourrez adapter en français.",
        linkHref: "/fr/christmas/messages",
        linkLabel: "Trouver un message de Noël",
      },
      {
        h2: "Comment créer une carte de Noël en ligne",
        body: "Un chemin simple, de la page vierge à une carte de Noël partageable.",
        list: [
          "Choisissez un style de carte de Noël",
          "Téléchargez une photo ou utilisez un portrait de Noël",
          "Écrivez votre message (ou faites-vous aider)",
          "Téléchargez le PNG ou partagez-le numériquement",
        ],
      },
    ],
    faqs: [
      {
        q: "Puis-je télécharger ma propre photo ?",
        a: "Oui. Téléchargez une photo comme pièce maîtresse de votre carte de Noël.",
      },
      {
        q: "Puis-je utiliser un portrait de Noël ?",
        a: "Oui. Si vous avez créé un portrait dans le générateur de photos de Noël, vous pouvez le transférer vers le créateur de cartes.",
      },
      {
        q: "Pouvez-vous m'aider à écrire le message ?",
        a: "L'aide intégrée aux messages prend en charge l'anglais et le roumain aujourd'hui. Pour plus d'options, visitez le générateur de messages de Noël.",
      },
      {
        q: "Y a-t-il des modèles de messages en français ?",
        a: "Pas encore directement dans l'assistant — il couvre aujourd'hui l'anglais et le roumain. Vous pouvez toujours saisir librement votre message en français et le combiner avec un design festif.",
      },
      {
        q: "Puis-je créer une carte en famille ?",
        a: "Oui. Des styles et mises en page adaptés aux familles font partie du créateur.",
      },
      {
        q: "Puis-je créer une carte avec un animal ?",
        a: "Oui. Les photos d'animaux fonctionnent bien dans plusieurs styles de cartes de Noël.",
      },
      {
        q: "Puis-je télécharger la carte ?",
        a: "Oui. Téléchargez un PNG haute résolution pour un usage personnel.",
      },
      {
        q: "Puis-je la partager numériquement ?",
        a: "Oui. Partagez-la via les options de partage de votre appareil, WhatsApp, e-mail, ou en copiant un lien lorsque disponible.",
      },
    ],
  },

  "/christmas/messages": {
    title: "Générateur de messages de Noël | Voeux pour la famille et les amis",
    description: "Trouvez le message de Noël parfait pour la famille, les amis et les collègues — puis utilisez-le dans une carte de Noël personnalisée.",
    h1: "Trouvez le message de Noël parfait",
    lede:
      "Découvrez comment notre générateur crée des voeux de Noël chaleureux, drôles, romantiques ou professionnels — aujourd'hui en anglais et en roumain — puis intégrez votre propre message en français dans une carte de Noël.",
    h2: "Transformez des mots en carte",
    links: [
      { href: "/fr/christmas/cards", label: "Créateur de cartes de Noël" },
      { href: "/fr/christmas/wishlist", label: "Liste de souhaits de Noël" },
      { href: "/fr/christmas/tree", label: "Sapin de Noël numérique" },
      { href: "/fr/christmas", label: "Accueil Noël" },
    ],
    breadcrumbs: [
      { href: "/fr/christmas", label: "Noël" },
      { href: "/fr/christmas/messages", label: "Messages" },
    ],
    geo: {
      h2: "Qu'est-ce qu'un générateur de messages de Noël ?",
      body:
        "Un générateur de messages de Noël vous aide à écrire des voeux de Noël en choisissant pour qui est le message et le ton souhaité — puis en générant des options de texte modifiables. Chez TheDigitalGifter, le texte généré fonctionne aujourd'hui en anglais et en roumain ; cette page explique le concept pour que vous puissiez l'adapter vous-même en français ou attendre une prise en charge future de la langue.",
    },
    sections: [
      {
        h2: "Comment fonctionne le générateur de messages de Noël",
        body:
          "Choisissez un destinataire, sélectionnez un ton, définissez une longueur (courte, moyenne ou longue), ajoutez éventuellement un détail personnel, et obtenez des options de message que vous pourrez modifier et utiliser. Les suggestions générées sont aujourd'hui en anglais et en roumain — utiles comme trame et source d'idées que vous reformulez vous-même en français.",
      },
      {
        h2: "Messages de Noël par destinataire",
        body:
          "Le générateur couvre les relations courantes à Noël. Lancez l'outil et choisissez à qui vous écrivez — les pages dédiées par destinataire ne sont pas encore disponibles.",
        list: ["Maman", "Papa", "Épouse", "Mari", "Petite amie", "Petit ami", "Famille", "Ami(e)", "Collègue"],
      },
      {
        h2: "Messages de Noël par ton",
        body:
          "Les options de ton disponibles aujourd'hui incluent chaleureux, drôle, romantique, sincère, court et doux, professionnel et religieux. Les textes générés sont aujourd'hui en anglais et en roumain.",
      },
      {
        h2: "Exemples de messages de Noël",
        body:
          "Directions de démonstration pour le type de voeux que l'outil peut vous aider à rédiger — adaptez tout pour que ça vous ressemble et sonne juste en français.",
        list: [
          "Note sincère pour maman, la remerciant pour une année de gentillesse discrète",
          "Voeu court et chaleureux pour un ami que vous ne voyez pas assez",
          "Ligne romantique de Noël pour le premier Noël en couple",
          "Message drôle et léger pour un collègue, qui reste adapté au cadre professionnel",
        ],
      },
      {
        h2: "Comment écrire un message de Noël sincère",
        body:
          "Adressez-vous à la personne par son prénom ou sa relation, mentionnez un souvenir ou une qualité partagée si cela convient, exprimez un sentiment clair, gardez un ton naturel et terminez de façon personnelle. Le générateur est un point de départ — votre propre formulation en français le rend authentique.",
      },
      {
        h2: "Utilisez votre message dans une carte de Noël",
        body: "Quand vous avez trouvé les mots qui vous plaisent, continuez vers le créateur de cartes de Noël et associez le message à une photo et un design.",
        linkHref: "/fr/christmas/cards",
        linkLabel: "Mettre ce message de Noël sur une carte",
      },
    ],
    faqs: [
      {
        q: "Comment fonctionne le générateur de messages de Noël ?",
        a: "Choisissez le destinataire, le ton et la longueur, ajoutez éventuellement un détail, puis obtenez des options de message que vous pouvez copier ou modifier.",
      },
      {
        q: "L'outil crée-t-il aussi des messages de Noël en français ?",
        a: "Le générateur crée aujourd'hui du texte en anglais et en roumain. Cette page explique le concept et donne une inspiration de structure que vous adaptez librement en français.",
      },
      {
        q: "Puis-je écrire un message pour mon partenaire ?",
        a: "Oui. Choisissez petite amie, petit ami, partenaire, épouse ou mari et un ton romantique ou chaleureux.",
      },
      {
        q: "Peut-il créer des messages de Noël drôles ?",
        a: "Oui. Sélectionnez le ton drôle — restez professionnel pour les messages destinés aux collègues.",
      },
      {
        q: "Puis-je modifier les messages générés ?",
        a: "Oui. Considérez le texte généré comme un brouillon et reformulez-le librement avant de l'envoyer ou de l'utiliser sur une carte.",
      },
      {
        q: "Peut-il créer des voeux de Noël courts ?",
        a: "Oui. Choisissez la longueur courte ou le ton « court et doux ».",
      },
      {
        q: "Puis-je utiliser un message dans une carte de Noël ?",
        a: "Oui. Continuez vers le créateur de cartes de Noël avec le transfert du message.",
      },
      {
        q: "Quelles langues sont prises en charge ?",
        a: "L'anglais et le roumain sont pris en charge aujourd'hui pour les textes générés.",
      },
    ],
  },
};

export const LOCALE = "fr";

/**
 * @param {string} basePath
 */
export function getChristmasSeoContent(basePath) {
  return CHRISTMAS_SEO_CONTENT[basePath] || null;
}
