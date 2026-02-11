export type GiftStyle = {
  id: string;
  name: string;
  description?: string;
  script?: string;
};

export type GiftStyleGroup = {
  title: string;
  subtitle?: string;
  styles: GiftStyle[];
};

export const GIFT_STYLES: Record<string, GiftStyleGroup> = {
  birthday: {
    title: "Birthday Gift Styles",
    subtitle: "Choose a style for your birthday gift",
    styles: [
      { id: "classic", name: "Classic", description: "A timeless, elegant style", script: "classic_script" },
      { id: "fun", name: "Fun", description: "Bright and playful", script: "fun_script" },
    ],
  },
};
