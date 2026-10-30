import alternateNameTypes from './alternate-name-type.json';
import scriptTypes from './script.json';

// Performance Optimization: Hoist static Map lookup tables outside function calls
// to replace linear array searches (.find) with O(1) hash map lookups.
const ALTERNATE_NAME_TYPE_MAP = new Map<string, { id: string; name: string }>(
  alternateNameTypes.types.map(t => [t.id, t])
);

const SCRIPT_TYPE_MAP = new Map<string, { id: string; name: string }>(
  scriptTypes.scripts.map(s => [s.id, s])
);

export function getAlternateNameTypeName(id: string): string {
  const type = ALTERNATE_NAME_TYPE_MAP.get(id);
  return type ? type.name : id;
}

export function getScriptName(id: string, language?: string): string {
  const script = SCRIPT_TYPE_MAP.get(id);
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
