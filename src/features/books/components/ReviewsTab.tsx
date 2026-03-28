import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reviewsByEditionQuery } from '@/features/books/reviews.queries';
import { ReviewCard } from './ReviewCard';
import { ReviewEditor } from './ReviewEditor';
import { Star, PenLine } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Review } from '@estante/common-types';

interface ReviewsTabProps {
  editionId: string;
  workId: string;
  myReview?: Review | null;
}

export const ReviewsTab: React.FC<ReviewsTabProps> = ({ editionId, workId, myReview }) => {
  const { user } = useAuth();
  const [isWriting, setIsWriting] = useState(false);

  // Page control for a potential "Ver mais"
  const [page] = useState(1);
  const limit = 20;

  const { data, isLoading, isError } = useQuery(reviewsByEditionQuery(editionId, page, limit, user?.uid));

  const visibleReviews = data?.data?.filter(r => {
    const textContent = r.content?.replace(/<[^>]*>?/gm, '').trim() || '';
    const hasMedia = /<img/i.test(r.content || '');
    return r.title || textContent.length >= 10 || hasMedia;
  }) || [];

  const userHasReviewed = user && data?.data ? data.data.some(r => r.userId === user.uid && r.content) : false;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header da Sessão */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            {/* <Star className="w-6 h-6 text-yellow-500 fill-current" /> */}
            Resenhas da Comunidade
          </h3>
          <p className="text-gray-500 text-sm mt-1 max-w-[300px] leading-relaxed">O que os leitores da Estante de Bolso estão achando desta edição.</p>
        </div>

        <div className="self-start sm:self-auto sm:w-[220px] flex sm:justify-end shrink-0">
          {!isWriting && user && !userHasReviewed && (
            <button
              onClick={() => setIsWriting(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm"
            >
              <PenLine className="w-4 h-4" />
              Escrever Resenha
            </button>
          )}
        </div>
      </div>

      {/* Editor Dropdown */}
      {isWriting && (
        <div className="bg-indigo-50/50 p-1 rounded-xl">
          <ReviewEditor
            editionId={editionId}
            workId={workId}
            myReview={myReview}
            onCancel={() => setIsWriting(false)}
            onSuccess={() => setIsWriting(false)}
          />
        </div>
      )}

      {/* Listagem de Resenhas */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 h-40 animate-pulse flex flex-col justify-between">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="space-y-2 flex-1 pt-1">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <div className="bg-red-50 text-red-600 p-6 rounded-xl text-center font-medium border border-red-100">
          Ocorreu um erro ao carregar as resenhas. Tente recarregar a página.
        </div>
      )}

      {!isLoading && !isError && visibleReviews.length === 0 && !isWriting && (
        <div className="bg-gray-50 border border-gray-100 border-dashed rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            <Star className="w-8 h-8 text-yellow-300 fill-current" />
          </div>
          <h3 className="text-gray-900 font-bold text-lg">Esta edição ainda não possui resenhas</h3>
          <p className="text-gray-500 text-sm mt-1 max-w-sm">Seja o primeiro a compartilhar sua opinião e ajude outros leitores a decidirem!</p>
        </div>
      )}

      {!isLoading && !isError && visibleReviews.length > 0 && (
        <div className="space-y-5">
          {visibleReviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
            />
          ))}
        </div>
      )}
    </div>
  );
};
