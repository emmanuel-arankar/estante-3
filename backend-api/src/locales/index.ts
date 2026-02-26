import { ptBR } from './pt-BR';
import { enUS } from './en-US';

export const locales = {
    'pt-BR': ptBR,
    'en-US': enUS,
    'pt': ptBR,
    'en': enUS,
};

export type LocaleCode = keyof typeof locales;
export const DEFAULT_LOCALE: LocaleCode = 'pt-BR';
