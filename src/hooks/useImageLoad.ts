import { useState, useEffect } from 'react';

export const useImageLoad = (src?: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setIsLoaded(true);
      setHasError(true);
      return;
    }

    setIsLoaded(false);
    setHasError(false);

    const img = new Image();
    img.src = src;
    
    img.onload = () => setIsLoaded(true);
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