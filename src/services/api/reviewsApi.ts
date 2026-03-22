import { apiClient } from '@/services/api/apiClient';
import { Review, ReviewComment } from '@estante/common-types';

export const createReviewAPI = async (data: { editionId: string, workId: string, rating?: number, title?: string, content: string, containsSpoiler: boolean }): Promise<Review> => {
    return apiClient<Review>('/reviews', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
};

export const getReviewsByEditionAPI = async (editionId: string, page = 1, limit = 20): Promise<{ data: Review[], page: number, limit: number }> => {
    return apiClient<{ data: Review[], page: number, limit: number }>(`/reviews/edition/${editionId}?page=${page}&limit=${limit}`);
};

export const getMyReviewByEditionAPI = async (editionId: string): Promise<{ data: Review | null }> => {
    return apiClient<{ data: Review | null }>(`/reviews/edition/${editionId}/my`);
};

export const getReviewByIdAPI = async (reviewId: string): Promise<Review> => {
    return apiClient<Review>(`/reviews/${reviewId}`);
};

export const updateReviewAPI = async (reviewId: string, data: { rating?: number | null, title?: string, content?: string, containsSpoiler?: boolean }): Promise<Review> => {
    return apiClient<Review>(`/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
};

export const deleteReviewAPI = async (reviewId: string): Promise<void> => {
    return apiClient<void>(`/reviews/${reviewId}`, {
        method: 'DELETE',
    });
};

export const createReviewCommentAPI = async (reviewId: string, data: { content: string, parentCommentId?: string }): Promise<ReviewComment> => {
    return apiClient<ReviewComment>(`/reviews/${reviewId}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
};

export const getReviewCommentsAPI = async (reviewId: string): Promise<{ data: ReviewComment[] }> => {
    return apiClient<{ data: ReviewComment[] }>(`/reviews/${reviewId}/comments`);
};

export const deleteReviewCommentAPI = async (reviewId: string, commentId: string): Promise<void> => {
    return apiClient<void>(`/reviews/${reviewId}/comments/${commentId}`, {
        method: 'DELETE',
    });
};

export const updateReviewCommentAPI = async (reviewId: string, commentId: string, content: string): Promise<ReviewComment> => {
    return apiClient<ReviewComment>(`/reviews/${reviewId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
};

export const likeReviewCommentAPI = async (reviewId: string, commentId: string): Promise<{ liked: boolean; likesCount: number }> => {
    return apiClient<{ liked: boolean; likesCount: number }>(`/reviews/${reviewId}/comments/${commentId}/like`, {
        method: 'POST',
    });
};

export const likeReviewAPI = async (reviewId: string): Promise<{ liked: boolean; likesCount: number }> => {
    return apiClient<{ liked: boolean; likesCount: number }>(`/reviews/${reviewId}/like`, {
        method: 'POST',
    });
};

export const getMyReviewLikeAPI = async (reviewId: string): Promise<{ liked: boolean }> => {
    return apiClient<{ liked: boolean }>(`/reviews/${reviewId}/likes/me`);
};

export const getReviewLikersAPI = async (reviewId: string): Promise<{ data: { userId: string; userName: string; userNickname: string; userPhotoUrl: string | null }[] }> => {
    return apiClient<{ data: { userId: string; userName: string; userNickname: string; userPhotoUrl: string | null }[] }>(`/reviews/${reviewId}/likes`);
};

export const getCommentLikersAPI = async (reviewId: string, commentId: string): Promise<{ data: { userId: string; userName: string; userNickname: string; userPhotoUrl: string | null }[] }> => {
    return apiClient<{ data: { userId: string; userName: string; userNickname: string; userPhotoUrl: string | null }[] }>(`/reviews/${reviewId}/comments/${commentId}/likes`);
};
