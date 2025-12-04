export interface Language {
  code: string;
  name: string;
  flag: string;
}

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ro", name: "Romanian", flag: "🇷🇴" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "no", name: "Norwegian", flag: "🇳🇴" },
  { code: "da", name: "Danish", flag: "🇩🇰" },
  { code: "fi", name: "Finnish", flag: "🇫🇮" },
  { code: "el", name: "Greek", flag: "🇬🇷" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
  { code: "cs", name: "Czech", flag: "🇨🇿" },
  { code: "hu", name: "Hungarian", flag: "🇭🇺" },
  { code: "bg", name: "Bulgarian", flag: "🇧🇬" },
];
