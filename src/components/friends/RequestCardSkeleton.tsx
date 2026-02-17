import { motion } from 'framer-motion';

/**
 * Skeleton loader para cards de solicitações de amizade
 * Similar ao FriendCardSkeleton mas otimizado para lista de requests
 */
export const RequestCardSkeleton = () => {
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
                    <div className="h-4 bg-gray-200 rounded w-36 animate-pulse" />
                    {/* Nickname skeleton */}
                    <div className="h-3 bg-gray-200 rounded w-28 animate-pulse" />
                    {/* Mutual friends skeleton */}
                    <div className="h-3 bg-gray-200 rounded w-40 animate-pulse" />
                </div>

                {/* Botões de ação skeleton */}
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <div className="w-24 h-9 bg-gray-200 rounded animate-pulse" />
                    <div className="w-24 h-9 bg-gray-200 rounded animate-pulse" />
                </div>
            </div>
        </motion.div>
    );
};

/**
 * Lista de skeletons para requests
 */
interface RequestCardSkeletonListProps {
    count?: number;
}

export const RequestCardSkeletonList = ({ count = 3 }: RequestCardSkeletonListProps) => {
    return (
        <div className="space-y-4">
            {Array.from({ length: count }).map((_, index) => (
                <RequestCardSkeleton key={index} />
            ))}
        </div>
    );
};
