import { useState, useEffect, memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    fallbackSrc?: string;
    skeletonClassName?: string;
    onLoadComplete?: () => void;
}

/**
 * Componente de imagem com lazy loading, skeleton loader e fallback.
 * Memoizado com React.memo para evitar re-renderizações desnecessárias quando o
 * componente pai atualiza o estado sem alterar as props da imagem.
 */
export const LazyImage = memo(function LazyImage({
    src,
    alt,
    fallbackSrc,
    skeletonClassName,
    className,
    onLoadComplete,
    ...props
}: LazyImageProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // Reset when src changes
        setIsLoading(true);
        setHasError(false);
        setImageSrc(null);

        const img = new Image();
        img.src = src;

        img.onload = () => {
            setImageSrc(src);
            setIsLoading(false);
            onLoadComplete?.();
        };

        img.onerror = () => {
            setHasError(true);
            setIsLoading(false);
            if (fallbackSrc) {
                setImageSrc(fallbackSrc);
            }
        };

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [src, fallbackSrc, onLoadComplete]);

    if (isLoading) {
        return <Skeleton className={skeletonClassName || className} />;
    }

    if (hasError && !fallbackSrc) {
        return (
            <div className={`bg-gray-200 dark:bg-gray-800 flex items-center justify-center rounded ${className}`}>
                <span className="text-gray-400 text-xs">Imagem indisponível</span>
            </div>
        );
    }

    return (
        <img
            src={imageSrc || fallbackSrc}
            alt={alt}
            className={className}
            loading="lazy"
            decoding="async"
            {...props}
        />
    );
});

LazyImage.displayName = 'LazyImage';
