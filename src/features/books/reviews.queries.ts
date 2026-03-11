import { queryOptions } from '@tanstack/react-query';
import { getReviewsByEditionAPI, getReviewCommentsAPI, getReviewByIdAPI, getMyReviewByEditionAPI } from '@/services/reviewsApi';

export const reviewsByEditionQuery = (editionId: string, page = 1, limit = 20) => queryOptions({
    queryKey: ['reviews', 'edition', editionId, { page, limit }],
    queryFn: () => getReviewsByEditionAPI(editionId, page, limit),
    staleTime: 1000 * 60 * 2, // 2 minutos
});

export const myReviewByEditionQuery = (editionId: string, isAuthenticated: boolean) => queryOptions({
    queryKey: ['reviews', 'edition', editionId, 'my'],
    queryFn: () => getMyReviewByEditionAPI(editionId),
    staleTime: 1000 * 60 * 2,
    enabled: isAuthenticated,
    retry: false,
});

export const reviewQuery = (reviewId: string) => queryOptions({
    queryKey: ['reviews', 'detail', reviewId],
    queryFn: () => getReviewByIdAPI(reviewId),
    staleTime: 1000 * 60 * 5, // 5 minutos
});

export const reviewCommentsQuery = (reviewId: string) => queryOptions({
    queryKey: ['reviews', reviewId, 'comments'],
    queryFn: () => getReviewCommentsAPI(reviewId),
    staleTime: 1000 * 60, // 1 minuto
});
