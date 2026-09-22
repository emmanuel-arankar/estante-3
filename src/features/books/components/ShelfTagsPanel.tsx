import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Archive, Heart, RefreshCw, Tag, Star, Target } from 'lucide-react';

interface ShelfTagsPanelProps {
  editionId: string;
  className?: string;
  initialTags?: {
    owned: boolean;
    wishlist: boolean;
    forTrade: boolean;
    forSale: boolean;
    favorite: boolean;
    yearlyGoal: boolean;
  };
}

const BUTTONS = [
  { key: 'favorite', label: 'Favorito', Icon: Star },
  { key: 'yearlyGoal', label: 'Meta', Icon: Target },
  { key: 'owned', label: 'Tenho', Icon: Archive },
  { key: 'wishlist', label: 'Desejo', Icon: Heart },
  { key: 'forTrade', label: 'Troco', Icon: RefreshCw },
  { key: 'forSale', label: 'Vendo', Icon: Tag },
] as const;

/**
 * PERFORMANCE: Wrapped in React.memo and hoisted static BUTTONS array outside render
 * body to avoid redundant object/JSX allocations and eliminate React.cloneElement overhead
 * during parent component re-renders.
 */
export const ShelfTagsPanel: React.FC<ShelfTagsPanelProps> = React.memo(({
  className,
  initialTags = { owned: false, wishlist: false, forTrade: false, forSale: false, favorite: false, yearlyGoal: false }
}) => {
  const [tags, setTags] = useState(initialTags);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const toggleTag = async (key: keyof typeof initialTags) => {
    setIsUpdating(key);
    // FIXME: Substituir pela mutação React Query na Fase 2B
    // Simulando delay de rede
    await new Promise(r => setTimeout(r, 600));
    setTags(prev => prev ? { ...prev, [key]: !prev[key as keyof typeof prev] } as NonNullable<typeof initialTags> : prev);
    setIsUpdating(null);
  };

  return (
    <div className={cn("mt-4 grid grid-cols-2 gap-2", className)}>
      {BUTTONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          disabled={isUpdating !== null}
          onClick={() => toggleTag(key)}
          className={cn(
            "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all",
            tags[key]
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-inner"
              : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700",
            isUpdating === key && "opacity-50 animate-pulse"
          )}
        >
          <Icon className={cn("w-4 h-4", tags[key] && "fill-current text-indigo-600")} />
          {label}
        </button>
      ))}
    </div>
  );
});

ShelfTagsPanel.displayName = 'ShelfTagsPanel';
