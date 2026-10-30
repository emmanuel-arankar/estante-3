import languageData from './book-languages.json';

export interface BookLanguage {
  id: string; // ISO Code
  name: string; // Nome em PT-BR
  flag?: string;
}

export const languages: BookLanguage[] = languageData.languages;

// Performance Optimization: Hoist static Map lookup table outside function calls
// to replace repeated O(n) array searches (.find / .some) with O(1) hash map lookups.
const LANGUAGE_MAP = new Map<string, BookLanguage>(
  languageData.languages.map(l => [l.id, l])
);

export const getLanguagesList = (): BookLanguage[] => {
  return languages;
};

export const getLanguageName = (id: string): string => {
  const language = LANGUAGE_MAP.get(id);
  return language ? language.name : id;
};

export const isValidLanguage = (id: string): boolean => {
  return LANGUAGE_MAP.has(id);
};

export const getLanguageFlag = (id: string): string => {
  const language = LANGUAGE_MAP.get(id);
  return language?.flag || '🌐';
};
