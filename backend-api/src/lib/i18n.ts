import { locales, DEFAULT_LOCALE, LocaleCode } from '../locales';

/**
 * @name Tradução (t)
 * @summary Busca uma mensagem traduzida no dicionário.
 * @description Retorna a string traduzida baseada na chave e no idioma fornecido.
 * Suporta chaves aninhadas usando pontos (ex: 'common.internalError').
 * 
 * @param {string} key - Chave da tradução (dot-notation)
 * @param {LocaleCode} lang - Código do idioma
 * @returns {string} Mensagem traduzida ou a própria chave se não encontrada
 */
export function t(key: string, lang: LocaleCode = DEFAULT_LOCALE): string {
    const dictionary = locales[lang] || locales[DEFAULT_LOCALE];

    // Navegação dinâmica por chaves (dot-notation)
    const result = key.split('.').reduce((obj: any, part) => {
        return obj && obj[part];
    }, dictionary);

    if (typeof result === 'string') {
        return result;
    }

    // Se não encontrar ou não for string, retorna a chave bruta para debug
    return key;
}
