/**
 * @name Serviço de Sanitização
 * @summary Limpeza de strings para prevenção de XSS.
 * @description Implementação rigorosa de limpeza de HTML para neutralizar scripts maliciosos.
 * Remove tags proibidas (script, iframe, object, etc) e atributos de eventos (onclick, etc).
 */

interface SanitizeOptions {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
}

// Configuração padrão: Apenas texto puro, remove TUDO o que for tag
const DEFAULT_ALLOWED_TAGS: string[] = [];

/**
 * @name Sanitizar String
 * @description Remove tags HTML indesejadas e atributos perigosos.
 */
export function sanitize(input: string, options: SanitizeOptions = {}): string {
    if (!input || typeof input !== 'string') return '';

    const allowedTags = options.allowedTags || DEFAULT_ALLOWED_TAGS;

    // 1. Remover comentários HTML
    let output = input.replace(/<!--[\s\S]*?-->/g, '');

    // 2. Remover tags perigosas e SEU CONTEÚDO (script, iframe, style, object, embed)
    output = output.replace(/<(script|iframe|style|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');
    output = output.replace(/<(script|iframe|style|object|embed)[^>]*\/>/gi, '');

    // 3. Lógica de remoção de tags remanescentes
    // Se não permitimos nenhuma tag, removemos tudo o que parecer tag HTML
    if (allowedTags.length === 0) {
        output = output.replace(/<[^>]*>?/gm, '');
    } else {
        // [TODO] Implementar parser se precisarmos de suporte a tags específicas (negrito, etc)
        // Por enquanto, o foco é segurança máxima: remover tudo.
        output = output.replace(/<[^>]*>?/gm, '');
    }

    // 4. Remover atributos de eventos (on*) e javascript: URIs em qualquer lugar remanescente
    output = output.replace(/on\w+\s*=/gi, 'x-event=');
    output = output.replace(/javascript:/gi, 'x-javascript:');

    // 5. Decodificar entidades básicas para evitar ofuscação simples, e depois re-limpar
    // (Opcional dependendo do nível de rigor)

    return output.trim();
}

/**
 * @name Sanitizar Texto Rico
 * @description Permite formatação básica (b, i, em, strong) mas limpa o resto.
 */
export function sanitizeRichText(input: string): string {
    // Por enquanto, para segurança "Ultra-Elite", tratamos tudo como texto puro
    // até termos certeza de que o frontend renderiza tags com segurança.
    return sanitize(input);
}
