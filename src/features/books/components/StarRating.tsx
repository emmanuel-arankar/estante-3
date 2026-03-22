import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface StarRatingProps {
    rating?: number;
    maxStars?: number;
    interactive?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    onRate?: (rating: number) => void;
    showLabel?: boolean;
    className?: string;
}

const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
};

const getStarColorClass = (rating: number) => {
    if (rating === 0) return 'text-gray-300';
    if (rating >= 4.5) return 'text-emerald-500';
    if (rating >= 3.5) return 'text-lime-500';
    if (rating >= 2.5) return 'text-yellow-400';
    if (rating >= 1.5) return 'text-orange-500';
    return 'text-red-500';
};

export const StarRating: React.FC<StarRatingProps> = ({
    rating = 0,
    maxStars = 5,
    interactive = false,
    size = 'md',
    onRate,
    showLabel = false,
    className,
}) => {
    const [hoverRating, setHoverRating] = useState(0);

    const displayRating = hoverRating > 0 ? hoverRating : rating;

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
        if (!interactive) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const isLeftHalf = e.clientX - rect.left < rect.width / 2;
        setHoverRating(isLeftHalf ? index - 0.5 : index);
    };

    const handleMouseLeave = () => {
        if (!interactive) return;
        setHoverRating(0);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
        if (!interactive || !onRate) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const isLeftHalf = e.clientX - rect.left < rect.width / 2;
        onRate(isLeftHalf ? index - 0.5 : index);
    };

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div
                className="flex items-center gap-1"
                onMouseLeave={handleMouseLeave}
            >
                {Array.from({ length: maxStars }).map((_, i) => {
                    const starValue = i + 1;
                    const fillValue = displayRating - i; // 1 (Full), 0.5 (Half), <= 0 (Empty)

                    return (
                        <button
                            type="button"
                            key={i}
                            disabled={!interactive}
                            className={cn(
                                'transition-colors relative',
                                interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default',
                                fillValue > 0 ? getStarColorClass(displayRating) : 'text-gray-300'
                            )}
                            onMouseMove={(e) => handleMouseMove(e, starValue)}
                            onClick={(e) => handleClick(e, starValue)}
                        >
                            <Star
                                className={cn(
                                    sizeClasses[size],
                                    fillValue >= 1 && 'fill-current' // Fill the entire star background if 1
                                )}
                            />
                            {/* Overlay the half-star colored if fillValue === 0.5 */}
                            {fillValue > 0 && fillValue < 1 && (
                                <div className={cn("absolute inset-0 overflow-hidden w-1/2 pointer-events-none", getStarColorClass(displayRating))}>
                                    <Star className={cn(sizeClasses[size], 'fill-current')} />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
            {showLabel && rating > 0 && (
                <span className="text-sm font-medium text-gray-700">
                    {rating.toFixed(1)}
                </span>
            )}
        </div>
    );
};
