/**
 * Christmas Wishlist copy pack — translation-ready keys.
 * Keep display strings here (or locale maps); never concatenate English fragments in UI.
 */

export type WishlistCopy = {
  brand: string;
  madeWith: string;
  seoTitle: string;
  seoDescription: string;
  shareSeoTitle: (name: string) => string;
  shareSeoDescription: (name: string) => string;
  unavailableTitle: string;
  unavailableBody: string;
  createMine: string;
  heroH1: string;
  heroSupport: string;
  ctaCreate: string;
  ctaHow: string;
  exampleTitle: string;
  createTitleAsk: string;
  createTitlePlaceholder: string;
  createForAsk: string;
  createSubmit: string;
  emptyAsk: string;
  emptyCta: string;
  addWish: string;
  pasteLink: string;
  writeWish: string;
  pasteLinkHint: string;
  linkImportFail: string;
  whatWant: string;
  whatWantExample: string;
  addNote: string;
  noteExample: string;
  addDetails: string;
  preferredPrice: string;
  externalLink: string;
  imageUrl: string;
  size: string;
  color: string;
  quantity: string;
  saveWish: string;
  cancel: string;
  shareCta: string;
  copyLink: string;
  shareWhatsApp: string;
  shareEmail: string;
  shareNative: string;
  linkCopied: string;
  enableShareFirst: string;
  turnShareOff: string;
  sharingOn: string;
  ownerStats: (wishes: number, shares: number, views: number) => string;
  reserve: string;
  reserved: string;
  purchased: string;
  markPurchased: string;
  alreadyTaken: string;
  openLink: string;
  edit: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  notSure: string;
  tryGiftFinder: string;
  personalIdeas: string;
  addPortrait: string;
  addSanta: string;
  addCard: string;
  addTree: string;
  putUnderTree: string;
  viralTitle: string;
  viralCta: string;
  howTitle: string;
  how1Title: string;
  how1Body: string;
  how2Title: string;
  how2Body: string;
  how3Title: string;
  how3Body: string;
  how4Title: string;
  how4Body: string;
  seoCreateTitle: string;
  seoCreateBody: string;
  seoAnywhereTitle: string;
  seoAnywhereBody: string;
  seoShareTitle: string;
  seoShareBody: string;
  seoDuplicateTitle: string;
  seoDuplicateBody: string;
  seoKidsTitle: string;
  seoKidsBody: string;
  geoWhatTitle: string;
  geoWhatBody: string;
  faqTitle: string;
  reservationFail: string;
  loading: string;
  saveListHint: string;
};

export const WISHLIST_COPY_EN: WishlistCopy = {
  brand: "TheDigitalGifter",
  madeWith: "Made with TheDigitalGifter",
  seoTitle: "Christmas Wishlist Maker | Create & Share Your Wish List",
  seoDescription:
    "Create a Christmas wishlist, add gifts from anywhere, and share one simple link with family and friends.",
  shareSeoTitle: (name) => `${name} 🎄`,
  shareSeoDescription: (name) => `See what ${name.replace(/'s Christmas Wishlist$/i, "").replace(/’s Christmas Wishlist$/i, "") || "they"} are wishing for this Christmas.`,
  unavailableTitle: "This Christmas Wishlist isn’t available anymore.",
  unavailableBody: "It may be private, or the owner turned sharing off.",
  createMine: "Create Your Own Wishlist",
  heroH1: "Create a Christmas Wishlist and Share One Simple Link",
  heroSupport:
    "Add gifts from anywhere, share your wishlist with one link, and make Christmas shopping easier for everyone.",
  ctaCreate: "Create My Wishlist",
  ctaHow: "See How It Works",
  exampleTitle: "Emma’s Christmas Wishlist",
  createTitleAsk: "What should we call your wishlist?",
  createTitlePlaceholder: "Paul’s Christmas Wishlist",
  createForAsk: "Who is this wishlist for?",
  createSubmit: "Create Wishlist",
  emptyAsk: "What are you wishing for this Christmas?",
  emptyCta: "+ Add Your First Wish",
  addWish: "+ Add a Wish",
  pasteLink: "Paste a product link",
  writeWish: "Write a wish",
  pasteLinkHint: "https://…",
  linkImportFail: "We couldn’t read that page automatically. You can still add the gift manually.",
  whatWant: "What do you want?",
  whatWantExample: "A weekend in Paris",
  addNote: "Add a note",
  noteExample: "Any weekend in March would be amazing.",
  addDetails: "Add details",
  preferredPrice: "Preferred price",
  externalLink: "Link",
  imageUrl: "Image link",
  size: "Size",
  color: "Color",
  quantity: "Quantity",
  saveWish: "Add to Wishlist",
  cancel: "Cancel",
  shareCta: "Share My Wishlist",
  copyLink: "Copy link",
  shareWhatsApp: "WhatsApp",
  shareEmail: "Email",
  shareNative: "Share",
  linkCopied: "Link copied",
  enableShareFirst: "Turn on sharing to get your link",
  turnShareOff: "Turn sharing off",
  sharingOn: "Sharing is on — anyone with the link can view",
  ownerStats: (wishes, shares, views) =>
    `${wishes} wish${wishes === 1 ? "" : "es"} · Shared ${shares} time${shares === 1 ? "" : "s"}${
      views > 0 ? ` · ${views} view${views === 1 ? "" : "s"}` : ""
    }`,
  reserve: "I’m getting this",
  reserved: "Someone is getting this 🎁",
  purchased: "Purchased",
  markPurchased: "Mark purchased",
  alreadyTaken: "This gift is already reserved.",
  openLink: "Open link",
  edit: "Edit",
  remove: "Remove",
  moveUp: "Move up",
  moveDown: "Move down",
  notSure: "Not sure what you want?",
  tryGiftFinder: "Try the Gift Finder",
  personalIdeas: "Looking for something more personal?",
  addPortrait: "Add a Christmas Portrait",
  addSanta: "Add a Santa Video",
  addCard: "Add a Christmas Card",
  addTree: "Add a Digital Christmas Tree",
  putUnderTree: "Put this wishlist under my Christmas Tree",
  viralTitle: "Want your own Christmas Wishlist?",
  viralCta: "Create Mine Free",
  howTitle: "How it works",
  how1Title: "Create your wishlist",
  how1Body: "It only takes a moment.",
  how2Title: "Add anything you want",
  how2Body: "Paste links or write wishes yourself.",
  how3Title: "Share with family and friends",
  how3Body: "One link makes Christmas shopping easier.",
  how4Title: "Keep the surprise",
  how4Body: "People can coordinate gifts without spoiling Christmas.",
  seoCreateTitle: "Create a Christmas Wishlist Online",
  seoCreateBody:
    "Build a shareable Christmas wishlist in minutes. Keep every gift idea in one place instead of scattering links across chats.",
  seoAnywhereTitle: "Add Anything You Wish For",
  seoAnywhereBody:
    "Paste a product URL from almost any store, write a manual wish, add notes, and include experiences or handmade ideas. If a link can’t be read automatically, you can still save the wish by hand.",
  seoShareTitle: "Share One Simple Link",
  seoShareBody:
    "Turn sharing on and send one wishlist link via copy, WhatsApp, email, or your device’s share sheet. Shared lists are reachable by people with the link and are not meant for search engines.",
  seoDuplicateTitle: "Avoid Duplicate Christmas Gifts",
  seoDuplicateBody:
    "Viewers can tap “I’m getting this” to reserve a gift. Reservations stay anonymous to the wishlist owner, so the surprise stays intact while family avoids buying the same thing twice.",
  seoKidsTitle: "Christmas Wishlists for Kids and Families",
  seoKidsBody:
    "Create a list for yourself, your child, or someone else, then share it with grandparents and friends. Pair it with the Gift Finder when you’re not sure what to ask for.",
  geoWhatTitle: "What is an online Christmas wishlist?",
  geoWhatBody:
    "An online Christmas wishlist is a shareable list of gifts or experiences someone would like to receive. On TheDigitalGifter, you create a list, add wishes from product links or free text, share one link with family and friends, and let people reserve gifts so shopping stays coordinated without spoiling the surprise.",
  faqTitle: "Frequently Asked Questions",
  reservationFail: "Couldn’t reserve that gift. Please try again.",
  loading: "Loading…",
  saveListHint: "Your wishlist is saved on this device. Sign in later to keep it across browsers.",
};

export const WISHLIST_FAQ_EN: { q: string; a: string }[] = [
  {
    q: "How do I create a Christmas wishlist?",
    a: "Open the Christmas Wishlist page, choose a name, and tap Create Wishlist. You can start adding wishes right away — no account required to begin.",
  },
  {
    q: "Can I add gifts from any store?",
    a: "Yes. Paste a product link from any store that uses a normal web address, or add the gift manually if the page can’t be read automatically.",
  },
  {
    q: "Can I add something without a product link?",
    a: "Absolutely. Write any wish — experiences, handmade ideas, or a simple “Surprise me.”",
  },
  {
    q: "Can I share my wishlist with family?",
    a: "Yes. Turn on sharing and send one link via WhatsApp, email, or your phone’s share sheet.",
  },
  {
    q: "Can people reserve gifts?",
    a: "Yes. Viewers can tap “I’m getting this” so others don’t buy the same gift.",
  },
  {
    q: "Will the wishlist owner see who bought something?",
    a: "No. Reservations stay anonymous so the surprise stays intact. The owner doesn’t see who reserved or purchased a gift.",
  },
  {
    q: "Can I create a wishlist for my child?",
    a: "Yes. When creating a list, choose “My child” (or family / someone else) and share the link with relatives.",
  },
  {
    q: "Is my shared wishlist public?",
    a: "Shared lists are reachable by anyone with the link, but they are not meant for search engines (noindex). Keep the link with people you trust, and turn sharing off anytime.",
  },
  {
    q: "Can I change my wishlist after sharing it?",
    a: "Yes. Add, edit, reorder, or remove wishes anytime. People with the link will see the updated list.",
  },
  {
    q: "Can I add Christmas experiences instead of products?",
    a: "Yes. Experiences, trips, and personalized Digital Gifter gifts are all welcome on your list.",
  },
];

export const EXAMPLE_WISHES = [
  { title: "Pink Bicycle", note: "With a little basket on the front ❤️", priority: "really_want" },
  { title: "LEGO Set", note: "", priority: "would_love" },
  { title: "Cozy Christmas Pajamas", note: "", priority: "would_love" },
  { title: "Trip to Disneyland", note: "", priority: "really_want" },
  { title: "Surprise Me", note: "", priority: "nice_to_have" },
] as const;
