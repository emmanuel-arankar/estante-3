import * as functions from 'firebase-functions/v2/storage';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import sharp from 'sharp';
import * as path from 'path';

// ==== ==== INICIALIZAÇÃO ==== ====

// Garante que o Admin SDK está inicializado (pode já estar no index.ts)
if (!admin.apps.length) {
    admin.initializeApp();
}

const storage = admin.storage();

// ==== ==== CONFIGURAÇÃO ==== ====

/** @description Pastas monitoradas para processamento automático */
const MONITORED_PATHS = [
    'avatars/',
    'chats/',
    'uploads/',
];

/** @description Qualidade de compressão para cada formato */
const QUALITY = {
    webp: 80,
    jpeg: 85,
    png: { quality: 80, compressionLevel: 8 },
} as const;

/** @description Tamanhos de thumbnail gerados */
const THUMBNAIL_SIZES = {
    avatar: { width: 200, height: 200 },
    preview: { width: 800, height: 800 },
} as const;

/** @description Extensões de imagem suportadas */
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];

// ==== ==== HELPERS ==== ====

/**
 * @description Verifica se o arquivo é uma imagem suportada para processamento
 */
const isSupportedImage = (filePath: string): boolean => {
    const ext = path.extname(filePath).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
};

/**
 * @description Verifica se o arquivo está em uma pasta monitorada
 */
const isInMonitoredPath = (filePath: string): boolean => {
    return MONITORED_PATHS.some(p => filePath.startsWith(p));
};

/**
 * @description Verifica se o arquivo já foi processado (evitar loop infinito)
 */
const isProcessedFile = (filePath: string): boolean => {
    return filePath.includes('_optimized') ||
        filePath.includes('_thumb') ||
        filePath.endsWith('.webp');
};

/**
 * @description Gera o caminho de saída para um arquivo processado
 */
const getOutputPath = (originalPath: string, suffix: string, extension: string): string => {
    const dir = path.dirname(originalPath);
    const baseName = path.basename(originalPath, path.extname(originalPath));
    return path.join(dir, `${baseName}${suffix}${extension}`);
};

// ==== ==== CLOUD FUNCTION ==== ====

/**
 * @description Cloud Function que processa imagens automaticamente quando são
 * enviadas ao Firebase Storage. Realiza:
 * 1. Compressão da imagem original
 * 2. Conversão para formato WebP (mais eficiente)
 * 3. Geração de thumbnails para avatares
 */
export const onImageUpload = functions.onObjectFinalized(
    {
        region: process.env.VITE_FIREBASE_REGION || 'us-central1',
        memory: '512MiB',
        timeoutSeconds: 120,
        // Limita o trigger ao bucket padrão
    },
    async (event) => {
        const filePath = event.data.name;
        const contentType = event.data.contentType;
        const bucket = storage.bucket(event.data.bucket);

        // ==== STEP 1: Validações ====

        // Ignorar arquivos não-imagem
        if (!contentType?.startsWith('image/')) {
            logger.info('Arquivo ignorado (não é imagem)', { filePath, contentType });
            return;
        }

        // Ignorar tipos de conteúdo não suportados
        if (!isSupportedImage(filePath)) {
            logger.info('Extensão não suportada', { filePath });
            return;
        }

        // Ignorar pastas não monitoradas
        if (!isInMonitoredPath(filePath)) {
            logger.info('Arquivo fora das pastas monitoradas', { filePath });
            return;
        }

        // Evitar loop infinito (não processar arquivos já processados)
        if (isProcessedFile(filePath)) {
            logger.info('Arquivo já processado, ignorando', { filePath });
            return;
        }

        logger.info('Processando imagem', {
            filePath,
            contentType,
            size: event.data.size,
        });

        try {
            // ==== STEP 2: Download da imagem original ====
            const file = bucket.file(filePath);
            const [buffer] = await file.download();

            logger.info('Imagem baixada', {
                filePath,
                originalSize: buffer.length,
            });

            // ==== STEP 3: Gerar versão WebP otimizada ====
            const webpPath = getOutputPath(filePath, '_optimized', '.webp');
            const webpBuffer = await sharp(buffer)
                .webp({ quality: QUALITY.webp })
                .toBuffer();

            await bucket.file(webpPath).save(webpBuffer, {
                metadata: {
                    contentType: 'image/webp',
                    metadata: {
                        processedFrom: filePath,
                        processedAt: new Date().toISOString(),
                        originalSize: String(buffer.length),
                        optimizedSize: String(webpBuffer.length),
                    },
                },
            });

            const compressionRatio = ((1 - webpBuffer.length / buffer.length) * 100).toFixed(1);
            logger.info('WebP gerado', {
                filePath: webpPath,
                originalSize: buffer.length,
                optimizedSize: webpBuffer.length,
                compressionRatio: `${compressionRatio}%`,
            });

            // ==== STEP 4: Gerar thumbnail (apenas para avatares) ====
            if (filePath.startsWith('avatars/')) {
                const thumbPath = getOutputPath(filePath, '_thumb', '.webp');
                const thumbBuffer = await sharp(buffer)
                    .resize(THUMBNAIL_SIZES.avatar.width, THUMBNAIL_SIZES.avatar.height, {
                        fit: 'cover',
                        position: 'centre',
                    })
                    .webp({ quality: QUALITY.webp })
                    .toBuffer();

                await bucket.file(thumbPath).save(thumbBuffer, {
                    metadata: {
                        contentType: 'image/webp',
                        metadata: {
                            processedFrom: filePath,
                            processedAt: new Date().toISOString(),
                            thumbnailSize: `${THUMBNAIL_SIZES.avatar.width}x${THUMBNAIL_SIZES.avatar.height}`,
                        },
                    },
                });

                logger.info('Thumbnail de avatar gerado', {
                    filePath: thumbPath,
                    size: thumbBuffer.length,
                });
            }

            // ==== STEP 5: Gerar preview redimensionado (para imagens de chat) ====
            if (filePath.startsWith('chats/')) {
                const previewPath = getOutputPath(filePath, '_preview', '.webp');

                // Só redimensiona se a imagem for grande
                const metadata = await sharp(buffer).metadata();
                const needsResize = (metadata.width || 0) > THUMBNAIL_SIZES.preview.width ||
                    (metadata.height || 0) > THUMBNAIL_SIZES.preview.height;

                let previewPipeline = sharp(buffer);
                if (needsResize) {
                    previewPipeline = previewPipeline.resize(
                        THUMBNAIL_SIZES.preview.width,
                        THUMBNAIL_SIZES.preview.height,
                        { fit: 'inside', withoutEnlargement: true }
                    );
                }

                const previewBuffer = await previewPipeline
                    .webp({ quality: QUALITY.webp })
                    .toBuffer();

                await bucket.file(previewPath).save(previewBuffer, {
                    metadata: {
                        contentType: 'image/webp',
                        metadata: {
                            processedFrom: filePath,
                            processedAt: new Date().toISOString(),
                            dimensions: `${metadata.width}x${metadata.height}`,
                        },
                    },
                });

                logger.info('Preview de chat gerado', {
                    filePath: previewPath,
                    size: previewBuffer.length,
                    resized: needsResize,
                });
            }

            logger.info('Processamento de imagem concluído', {
                filePath,
                originalSize: buffer.length,
                webpSize: webpBuffer.length,
                savings: `${compressionRatio}%`,
            });

        } catch (error) {
            logger.error('Erro ao processar imagem', {
                filePath,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }
);
