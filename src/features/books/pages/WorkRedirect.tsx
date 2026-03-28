import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getWorkEditionsAPI } from '@/features/books/services/booksApi';
import { PATHS } from '@/router/paths';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { BookOpen } from 'lucide-react';

const LOADING_PHRASES = [
  "Abobadando as prateleiras...",
  "Espanando a poeira virtual das páginas...",
  "Negociando orelhas com o editor...",
  "Dobrando as pontinhas das páginas secretamente...",
  "Verificando a espessura da lombada...",
  "Tirando os livros da mala...",
  "Organizando as estantes por cor..."
];

export const WorkRedirect = () => {
  const { workId } = useParams<{ workId: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [randomPhrase, setRandomPhrase] = useState(LOADING_PHRASES[0]);

  useEffect(() => {
    setRandomPhrase(LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)]);
  }, []);

  useEffect(() => {
    const fetchAndRedirect = async () => {
      if (!workId) {
        setError('ID da obra não fornecido');
        return;
      }

      try {
        // Busca as edições desta obra (agora retorna PaginatedResponse)
        const response = await getWorkEditionsAPI(workId);
        const editions = response.data;

        if (editions && editions.length > 0) {
          // Pega a primeira edição (o backend já ordena por publicação desc)
          const targetEditionId = editions[0].id;

          // Redireciona substituindo o histórico para evitar voltar pra cá
          navigate(PATHS.BOOK({ editionId: targetEditionId }), { replace: true });
        } else {
          setError('Esta obra está cadastrada, mas ainda não possui nenhuma edição (livro físico, e-book, etc) vinculada a ela.');
        }
      } catch (err) {
        console.error('Erro ao buscar edições para redirecionamento:', err);
        setError('Erro ao carregar os dados da obra.');
      }
    };

    fetchAndRedirect();
  }, [workId, navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <div className="bg-red-50 p-4 rounded-full mb-4">
          <BookOpen className="h-10 w-10 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Obra sem Edições</h2>
        <p className="text-gray-500 max-w-md">{error}</p>
        <div className="mt-8 flex gap-4">
          <button
            onClick={() => navigate(PATHS.HOME)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            Voltar para o Início
          </button>
          {/* Futuro botão de Adicionar Edição */}
          <button
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium cursor-not-allowed opacity-50"
            title="Em breve"
          >
            Adicionar Edição
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-[60vh] items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" className="text-emerald-600 mb-4" />
      <p className="text-gray-500 font-medium animate-pulse">{randomPhrase}</p>
    </div>
  );
};
