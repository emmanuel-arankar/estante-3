import { cn } from '@/lib/utils';

interface OnlineStatusProps {
  isOnline: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const OnlineStatus = ({ isOnline, className, size = 'sm' }: OnlineStatusProps) => {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <div
      className={cn(
        'rounded-full border-2 border-white',
        sizeClasses[size],
        isOnline ? 'bg-green-500' : 'bg-gray-400',
        className
      )}
    />
  );
};