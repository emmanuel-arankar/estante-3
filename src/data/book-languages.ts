import languageData from './book-languages.json';

export interface BookLanguage {
  id: string; // ISO Code
  name: string; // Nome em PT-BR
}

export const getLanguagesList = (): BookLanguage[] => {
  return languageData.languages;
};

export const getLanguageName = (id: string): string => {
  const language = languageData.languages.find(l => l.id === id);
  return language ? language.name : id;
};

export const isValidLanguage = (id: string): boolean => {
  return languageData.languages.some(l => l.id === id);
};

export const getLanguageFlag = (id: string): string => {
  const language = languageData.languages.find(l => l.id === id);
  return language?.flag || '🌐';
};
