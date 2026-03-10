import { memo } from 'react';
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

// ✅ Move static style objects outside to avoid re-creation on every render
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

/**
 * OptimizedAvatar: Renders an avatar with image caching, skeleton loading, and instant cached display.
 *
 * ⚡ Performance:
 * - Uses memo() to skip re-renders if props don't change.
 * - Instant display if image is in memory cache (via useImageCache).
 * - Static style objects moved outside component.
 */
export const OptimizedAvatar = memo(({
  src,
  alt,
  fallback,
  className = '',
  size = 'md',
  isOnline
}: OptimizedAvatarProps) => {
  const { isLoaded, hasError } = useImageCache(src);

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

      {/* ⚡ Real Avatar: Displayed instantly if loaded/cached, otherwise hidden until loaded */}
      <Avatar className={`h-full w-full ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}>
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
});

OptimizedAvatar.displayName = 'OptimizedAvatar';
