export const generateSearchTerms = (...fields: (string | undefined | null)[]): string[] => {
    const terms = new Set<string>();

    for (const field of fields) {
        if (!field || typeof field !== 'string') continue;

        const normalized = field
            .toLowerCase()
            .normalize('NFD') // Decompõe os acentos
            .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
            .trim();

        if (!normalized) continue;

        // Adiciona a string inteira normalizada
        terms.add(normalized);

        // Adiciona todos os prefixos da string inteira (ex: "emmanuel" -> "e", "em", "emm", "emma", ...)
        for (let i = 1; i <= normalized.length; i++) {
            terms.add(normalized.substring(0, i));
        }

        // Divide em palavras e adiciona todos os prefixos de cada palavra
        const words = normalized.split(/\s+/);
        if (words.length > 1) {
            for (const word of words) {
                if (!word) continue;
                terms.add(word);
                for (let i = 1; i <= word.length; i++) {
                    terms.add(word.substring(0, i));
                }
            }
        }
    }

    // Retorna como array, filtrando strings vazias
    return Array.from(terms).filter(term => term.length > 0);
};
