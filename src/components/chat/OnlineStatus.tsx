import React from 'react';
import { useUserPresence } from "@/hooks/useUserPresence";

interface OnlineStatusProps {
  userId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_PIXELS = {
  sm: '12px',
  md: '16px',
  lg: '20px',
} as const;

/**
 * OnlineStatus renders an online/offline status indicator dot for a user.
 * Wrapped in React.memo for PERFORMANCE optimization to avoid unnecessary re-renders
 * when parent lists or chat headers re-render with identical props.
 */
export const OnlineStatus = React.memo(({ userId, className, size = 'sm' }: OnlineStatusProps) => {
  const { online } = useUserPresence(userId);

  return (
    <div
      style={{
        height: SIZE_PIXELS[size],
        width: SIZE_PIXELS[size],
        borderRadius: '50%',
        border: '2px solid white',
        backgroundColor: online ? '#22c55e' : '#9ca3af',
      }}
      className={className}
      title={online ? "Online" : "Offline"}
    />
  );
});

OnlineStatus.displayName = 'OnlineStatus';
