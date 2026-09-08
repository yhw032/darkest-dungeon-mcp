export const gameLanguageCodes = [
  "en",
  "fr",
  "de",
  "es",
  "pt-BR",
  "ru",
  "pl",
  "cs",
  "it",
  "zh-CN",
  "ja",
  "ko",
] as const;

export type GameLanguage = (typeof gameLanguageCodes)[number];

export const gameLocalizationIdByLanguage: Readonly<
  Record<GameLanguage, string>
> = {
  en: "english",
  fr: "french",
  de: "german",
  es: "spanish",
  "pt-BR": "brazilian",
  ru: "russian",
  pl: "polish",
  cs: "czech",
  it: "italian",
  "zh-CN": "schinese",
  ja: "japanese",
  ko: "koreana",
};

export const supportedGameLocalizationIds: ReadonlySet<string> = new Set(
  Object.values(gameLocalizationIdByLanguage),
);

export function getGameLocalizationId(language: GameLanguage): string {
  return gameLocalizationIdByLanguage[language];
}
