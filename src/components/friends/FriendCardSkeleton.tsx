import { motion } from 'framer-motion';

/**
 * Skeleton loader para cards de amizade
 * Usado durante carregamento inicial das listas
 */
export const FriendCardSkeleton = () => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-4"
        >
            <div className="flex items-center space-x-4">
                {/* Avatar skeleton */}
                <div
                    className="w-12 h-12 rounded-full bg-gray-200 animate-pulse"
                    aria-label="Carregando avatar"
                />

                <div className="flex-1 space-y-2">
                    {/* Nome skeleton */}
                    <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                    {/* Nickname skeleton */}
                    <div className="h-3 bg-gray-200 rounded w-24 animate-pulse" />
                </div>

                {/* Botões skeleton */}
                <div className="flex space-x-2">
                    <div className="w-20 h-9 bg-gray-200 rounded animate-pulse" />
                    <div className="w-20 h-9 bg-gray-200 rounded animate-pulse" />
                </div>
            </div>
        </motion.div>
    );
};

/**
 * Lista de skeletons para loading inicial
 */
interface FriendCardSkeletonListProps {
    count?: number;
}

export const FriendCardSkeletonList = ({ count = 5 }: FriendCardSkeletonListProps) => {
    return (
        <div className="space-y-4">
            {Array.from({ length: count }).map((_, index) => (
                <FriendCardSkeleton key={index} />
            ))}
        </div>
    );
};
