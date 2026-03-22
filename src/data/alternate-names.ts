import alternateNameTypes from './alternate-name-type.json';
import scriptTypes from './script.json';

export function getAlternateNameTypeName(id: string): string {
  const type = alternateNameTypes.types.find(t => t.id === id);
  return type ? type.name : id;
}

export function getScriptName(id: string, language?: string): string {
  const script = scriptTypes.scripts.find(s => s.id === id);
  if (!script) return id;

  // Tratamento especial para o script "Han" (Hani) para evitar labels genéricos
  if (id === 'Hani') {
    if (language === 'ja') return 'Kanji';
    if (language?.startsWith('zh')) return 'Hanzi';
  }

  return script.name;
}

export interface AlternateName {
  value: string;
  language?: string;
  script?: string;
  type?: string;
}

const alternateNamePriority: Record<string, number> = {
  'native': 1,
  'romanized': 2,
  'translation': 3,
  'phonetic': 4,
  'other': 5,
  '': 6
};

export function getAlternateNamePriority(type?: string): number {
  return alternateNamePriority[type || ''] || 99;
}

export function sortAlternateNames<T extends { type?: string }>(names: T[]): T[] {
  return [...names].sort((a, b) => {
    const pA = getAlternateNamePriority(a.type);
    const pB = getAlternateNamePriority(b.type);
    return pA - pB;
  });
}
