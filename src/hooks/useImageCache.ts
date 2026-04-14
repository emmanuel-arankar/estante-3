import { useState, useEffect } from 'react';

const imageCache = new Map<string, HTMLImageElement>();

export const useImageCache = (src?: string) => {
  // ⚡ BOLT OPTIMIZATION: Use lazy initializer to check cache immediately on mount
  // preventing 1-frame flicker for cached images.
  const [isLoaded, setIsLoaded] = useState(() => !!src && imageCache.has(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setIsLoaded(true);
      setHasError(true);
      return;
    }

    // ✅ Verificar se já está no cache (caso src tenha mudado)
    if (imageCache.has(src)) {
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);
    setHasError(false);

    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      // ✅ Adicionar ao cache
      imageCache.set(src, img);
      setIsLoaded(true);
    };
    
    img.onerror = () => {
      setIsLoaded(true);
      setHasError(true);
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { isLoaded, hasError };
};
