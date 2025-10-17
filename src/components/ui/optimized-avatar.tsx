import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingSpinner } from './loading-spinner';
import { useImageCache } from '@/hooks/useImageCache';

interface OptimizedAvatarProps {
  src?: string;
  alt: string;
  fallback: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const OptimizedAvatar = ({ 
  src, 
  alt, 
  fallback, 
  className = '', 
  size = 'md' 
}: OptimizedAvatarProps) => {
  const { isLoaded, hasError } = useImageCache(src);
  const [showImage, setShowImage] = useState(false);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-32 w-32'
  };

  // ✅ Mostrar imagem apenas após breve delay para evitar flicker
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => setShowImage(true), 50);
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
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
            className="object-cover"
          />
        ) : null}
        <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-medium">
          {fallback.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  );
};