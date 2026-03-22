import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createReviewAPI, updateReviewAPI } from '@/services/api/reviewsApi';
import { Loader2, SendHorizonal } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Review } from '@estante/common-types';
import { trackEvent } from '@/lib/analytics';

interface ReviewEditorProps {
    editionId: string;
    workId: string;
    myReview?: Review | null;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export const ReviewEditor: React.FC<ReviewEditorProps> = ({ editionId, workId, myReview, onSuccess, onCancel }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [error, setError] = useState('');

    const mutation = useMutation({
        mutationFn: async (payload: any) => {
            if (myReview) {
                return updateReviewAPI(myReview.id, payload);
            }
            return createReviewAPI({ ...payload, editionId, workId });
        },
        onSuccess: () => {
            if (!myReview) {
                trackEvent('review_created');
            }
            queryClient.invalidateQueries({ queryKey: ['reviews'] });
            queryClient.invalidateQueries({ queryKey: ['editions', editionId] });
            setTitle('');
            setContent('');
            if (onSuccess) onSuccess();
        },
        onError: (err: any) => {
            setError(err.response?.data?.error || 'Erro ao publicar a resenha. Verifique os dados e tente novamente.');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const cleanContentLength = content.replace(/<[^>]*>?/gm, '').trim().length;
        if (cleanContentLength < 10) {
            setError('Sua avaliação deve ter pelo menos 10 caracteres lidos.');
            return;
        }

        mutation.mutate({
            title: title || null,
            content,
            containsSpoiler: content.includes('data-spoiler')
        });
    };

    if (!user) {
        return (
            <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-2">Faça login para avaliar</h3>
                <p className="text-gray-500 text-sm">Você precisa de uma conta ativa para interagir com a comunidade literária.</p>
            </div>
        );
    }

    const cleanContentLength = content.replace(/<[^>]*>?/gm, '').trim().length;
    const hasMedia = /<img/i.test(content);
    const isValid = cleanContentLength >= 10 || hasMedia;

    return (
        <form lang="pt-BR" onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6 overflow-hidden">
            <h3 className="font-bold text-gray-900 mb-4 text-lg">O que você achou dessa edição?</h3>

            <div className="space-y-4">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Título (Opcional)</label>
                    <input
                        id="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex: Uma obra-prima da ficção científica"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder:text-sm placeholder:font-medium text-sm font-medium text-gray-700 antialiased"
                        disabled={mutation.isPending}
                        maxLength={100}
                    />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">Sua Resenha</label>
                    </div>
                    <RichTextEditor
                        value={content}
                        onChange={setContent}
                        placeholder="Escreva sua resenha detalhada aqui... (mín. 10 caracteres)"
                        maxLength={50000}
                        variant="full"
                    />
                </div>

                <div className="flex items-center gap-2 pt-2 pb-1">
                    <input
                        type="checkbox"
                        id="containsSpoiler"
                        checked={content.includes('data-spoiler')}
                        readOnly
                        disabled
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                    />
                    <label htmlFor="containsSpoiler" className="text-sm text-gray-700">
                        Contém spoilers (marcado automaticamente se você ocultar trechos no botão do editor)
                    </label>
                </div>
            </div>

            {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start">
                    <div className="shrink-0 mr-2 mt-0.5">•</div>
                    {error}
                </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={mutation.isPending}
                    >
                        Cancelar
                    </button>
                )}

                <button
                    type="submit"
                    disabled={mutation.isPending || !isValid}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {mutation.isPending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Publicando...
                        </>
                    ) : (
                        <>
                            <SendHorizonal className="w-4 h-4" /> Publicar
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};
