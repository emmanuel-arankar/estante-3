import { useState, useEffect } from 'react';

const imageCache = new Map<string, HTMLImageElement>();

export const useImageCache = (src?: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setIsLoaded(true);
      setHasError(true);
      return;
    }

    // ✅ Verificar se já está no cache
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