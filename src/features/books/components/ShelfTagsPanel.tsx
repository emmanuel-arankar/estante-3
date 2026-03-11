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

export const ShelfTagsPanel: React.FC<ShelfTagsPanelProps> = ({
    editionId,
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

    const buttons = [
        { key: 'favorite', label: 'Favorito', icon: <Star className="w-4 h-4" /> },
        { key: 'yearlyGoal', label: 'Meta', icon: <Target className="w-4 h-4" /> },
        { key: 'owned', label: 'Tenho', icon: <Archive className="w-4 h-4" /> },
        { key: 'wishlist', label: 'Desejo', icon: <Heart className="w-4 h-4" /> },
        { key: 'forTrade', label: 'Troco', icon: <RefreshCw className="w-4 h-4" /> },
        { key: 'forSale', label: 'Vendo', icon: <Tag className="w-4 h-4" /> },
    ] as const;

    return (
        <div className={cn("mt-4 grid grid-cols-2 gap-2", className)}>
            {buttons.map(({ key, label, icon }) => (
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
                    {React.cloneElement(icon as React.ReactElement, {
                        className: cn("w-4 h-4", tags[key] && "fill-current text-indigo-600")
                    })}
                    {label}
                </button>
            ))}
        </div>
    );
};
