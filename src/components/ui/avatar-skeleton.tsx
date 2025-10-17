import { motion } from 'framer-motion';

interface AvatarSkeletonProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const AvatarSkeleton = ({ size = 'md' }: AvatarSkeletonProps) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-32 w-32'
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`${sizeClasses[size]} bg-gray-200 rounded-full animate-pulse`}
    />
  );
};