/**
 * Helper para URLs do CDN
 * 
 * Converte URLs do Firebase Storage para URLs do CDN quando configurado.
 * Isso permite ativar CDN no futuro sem mudar código frontend.
 */

/**
 * Converte URL do Firebase Storage para URL do CDN
 * 
 * @param storageUrl - URL original do Firebase Storage
 * @returns URL do CDN se configurado, senão retorna URL original
 */
export function getCDNUrl(storageUrl: string | undefined | null): string | undefined {
    if (!storageUrl) return undefined;

    // CDN Domain configurado via env (vazio por padrão)
    const CDN_DOMAIN = import.meta.env.VITE_CDN_DOMAIN || '';

    if (!CDN_DOMAIN) {
        return storageUrl; // Fallback: usar URL original do Firebase
    }

    try {
        // Extrair path do Firebase Storage URL
        // Formato: firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile?alt=media
        const url = new URL(storageUrl);

        // Verificar se é uma URL do Firebase Storage
        if (!url.hostname.includes('firebasestorage.googleapis.com')) {
            return storageUrl;
        }

        const pathMatch = url.pathname.match(/\/o\/(.+)/);

        if (!pathMatch) return storageUrl;

        const encodedPath = pathMatch[1];
        const decodedPath = decodeURIComponent(encodedPath);

        // Construir URL do CDN
        return `${CDN_DOMAIN}/${decodedPath}`;
    } catch (error) {
        console.warn('Erro ao converter URL para CDN:', error);
        return storageUrl; // Fallback em caso de erro
    }
}

/**
 * Gera URL otimizada para imagens com transformações
 * 
 * Útil quando usar serviços como Cloudflare Images ou imgix no futuro.
 * Por enquanto, apenas retorna a URL do CDN.
 * 
 * @param storageUrl - URL original do Firebase Storage
 * @param options - Opções de transformação (width, height, format)
 * @returns URL otimizada
 */
export function getOptimizedImageUrl(
    storageUrl: string | undefined | null,
    options: {
        width?: number;
        height?: number;
        format?: 'webp' | 'avif' | 'auto';
        quality?: number;
    } = {}
): string | undefined {
    const cdnUrl = getCDNUrl(storageUrl);

    if (!cdnUrl) return undefined;

    // Se não tiver transformações, retorna direto
    if (!options.width && !options.height && !options.format && !options.quality) {
        return cdnUrl;
    }

    // TODO: Implementar transformação quando configurar serviço de imagens
    // Exemplo para Cloudflare Images:
    // const params = new URLSearchParams();
    // if (options.width) params.set('width', options.width.toString());
    // if (options.height) params.set('height', options.height.toString());
    // if (options.format) params.set('format', options.format);
    // return `${CDN_DOMAIN}/cdn-cgi/image/${params.toString()}/${path}`;

    // Por enquanto, apenas retorna URL do CDN sem transformações
    return cdnUrl;
}

/**
 * Configurações de cache recomendadas por tipo de asset
 */
export const CACHE_CONFIGS = {
    // Assets imutáveis (nome tem hash/timestamp)
    IMMUTABLE: 'public, max-age=31536000, immutable', // 1 ano

    // Imagens de perfil (mudam ocasionalmente)
    PROFILE_PHOTO: 'public, max-age=86400', // 1 dia

    // Imagens de posts (raramente mudam)
    POST_IMAGE: 'public, max-age=604800', // 1 semana

    // Capas de livros (nunca mudam)
    BOOK_COVER: 'public, max-age=31536000', // 1 ano

    // Arquivos temporários
    TEMPORARY: 'public, max-age=3600, must-revalidate', // 1 hora
} as const;
