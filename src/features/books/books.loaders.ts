import { redirect } from 'react-router-dom';
import { toastErrorClickable } from '@/components/ui/toast';
import { editionQuery, workQuery } from '@/features/books/books.queries';
import { queryClient } from '@/lib/queryClient';
import { PATHS } from '@/router/paths';

/**
 * Loader para página de Edição de Livro.
 * Garante que a edição e a obra sejam carregadas da API (ou cache) antes de renderizar.
 */
export const bookDetailLoader = async ({ params }: any) => {
  const { editionId } = params;
  if (!editionId) return redirect(PATHS.HOME);

  try {
    const edition = await queryClient.ensureQueryData(editionQuery(editionId));

    // Se a edição existir, buscamos a obra (Work) para carregar todos os detalhes vinculados
    if (edition?.workId) {
      // Fazemos o prefetch do work, mas não bloqueamos se falhar
      queryClient.prefetchQuery(workQuery(edition.workId)).catch(console.error);
    }

    return { edition };
  } catch (error) {
    console.error('BookPage Loader error:', error);
    toastErrorClickable('Edição não encontrada.');
    return redirect(PATHS.HOME);
  }
};