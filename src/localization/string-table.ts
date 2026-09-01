export type LocalizationByLanguage = Map<string, Map<string, string>>;

function decodeXmlText(value: string): string {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .trim();
}

export function parseStringTableXml(
  text: string,
  includedLanguages?: ReadonlySet<string>,
): LocalizationByLanguage {
  const result: LocalizationByLanguage = new Map();
  const languagePattern = /<language\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/language>/g;
  for (const languageMatch of text.matchAll(languagePattern)) {
    const language = languageMatch[1];
    const body = languageMatch[2];
    if (language === undefined || body === undefined) continue;
    if (includedLanguages !== undefined && !includedLanguages.has(language)) {
      continue;
    }

    const entries = result.get(language) ?? new Map<string, string>();
    const entryPattern = /<entry\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/entry>/g;
    for (const entryMatch of body.matchAll(entryPattern)) {
      const id = entryMatch[1];
      const value = entryMatch[2];
      if (id !== undefined && value !== undefined) {
        entries.set(id, decodeXmlText(value));
      }
    }
    result.set(language, entries);
  }
  return result;
}

export function mergeStringTables(
  target: LocalizationByLanguage,
  source: LocalizationByLanguage,
): void {
  for (const [language, entries] of source) {
    const combined = target.get(language) ?? new Map<string, string>();
    for (const [id, value] of entries) combined.set(id, value);
    target.set(language, combined);
  }
}
