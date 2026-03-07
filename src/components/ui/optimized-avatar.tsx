import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useImageCache } from '@/hooks/useImageCache';

interface OptimizedAvatarProps {
  src?: string;
  alt: string;
  fallback: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
}

export const OptimizedAvatar = ({
  src,
  alt,
  fallback,
  className = '',
  size = 'md',
  isOnline
}: OptimizedAvatarProps) => {
  const { isLoaded, hasError } = useImageCache(src);
  const [showImage, setShowImage] = useState(false);

  const sizeClasses = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-32 w-32'
  };

  const textClasses = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-2xl',
    xl: 'text-5xl'
  };

  // ✅ Mostrar imagem apenas após breve delay para evitar flicker
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => setShowImage(true), 50);
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  return (
    <div className={`relative rounded-full ${sizeClasses[size]} ${className}`}>
      {/* Skeleton durante o carregamento */}
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-full"
          >
            <LoadingSpinner size="sm" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar real - sempre renderizado mas invisível até carregar */}
      <Avatar className={`h-full w-full ${showImage ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}>
        {src && !hasError ? (
          <AvatarImage
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="object-cover"
          />
        ) : null}
        <AvatarFallback className={`bg-emerald-100 text-emerald-700 font-medium ${textClasses[size]}`}>
          {fallback.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Status Online */}
      {isOnline && (
        <span className="absolute bottom-0 right-0 block h-1/4 w-1/4 rounded-full bg-green-500 ring-2 ring-white" />
      )}
    </div>
  );
};