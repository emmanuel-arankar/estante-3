/**
 * Utilitários para formatação e validação de ISBN-10 e ISBN-13
 */

/**
 * Limpa o ISBN removendo tudo exceto números e o caractere 'X' (case insensitive)
 */
export function cleanISBN(isbn: string): string {
    if (!isbn) return '';
    return isbn.replace(/[^0-9X]/gi, '').toUpperCase();
}

/**
 * Formata um ISBN-10 com hífens. 
 * Padrão comum: X-XXXX-XXXX-X (mas pode variar)
 */
export function formatISBN10(isbn: string): string {
    const clean = cleanISBN(isbn);
    if (clean.length !== 10) return isbn;

    // Heurística simples de hifenização para ISBN-10
    // Grupo-Editor-Título-Check
    return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 9)}-${clean.slice(9)}`;
}

/**
 * Formata um ISBN-13 com hífens.
 * Padrão comum: XXX-XX-XXXX-XXXX-X
 */
export function formatISBN13(isbn: string): string {
    const clean = cleanISBN(isbn);
    if (clean.length !== 13) return isbn;

    // Heurística comum para ISBN-13
    return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 8)}-${clean.slice(8, 12)}-${clean.slice(12)}`;
}

/**
 * Formata um ISBN detectando automaticamente se é 10 ou 13
 */
export function formatISBN(isbn: string | undefined | null): string {
    if (!isbn) return '---';

    const clean = cleanISBN(isbn);

    if (clean.length === 13) {
        return formatISBN13(clean);
    }

    if (clean.length === 10) {
        return formatISBN10(clean);
    }

    return isbn; // Retorna original se não detectado
}
