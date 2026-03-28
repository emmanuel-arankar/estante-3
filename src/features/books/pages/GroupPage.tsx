import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Info, Users } from 'lucide-react';
import { getGroupAPI, getGroupEditionsAPI } from '@/features/books/services/booksApi';
import { PATHS } from '@/router/paths';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Edition } from '@estante/common-types';
import { formatPublicationDate } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

export function GroupPage() {
  const { groupId } = useParams();
  const [imageError, setImageError] = useState(false);

  // Fetch details
  const { data: group, isLoading: isLoadingGroup, error: errorGroup } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroupAPI(groupId!),
    enabled: !!groupId,
  });

  // Fetch editions
  const { data: editionsData, isLoading: isLoadingEditions } = useQuery({
    queryKey: ['group', groupId, 'editions'],
    queryFn: () => getGroupEditionsAPI(groupId!),
    enabled: !!groupId,
  });

  // Rastrear visualização do perfil do grupo
  useEffect(() => {
    if (group?.id) {
      trackEvent('author_viewed', { group_id: group.id, name: group.name, type: 'group' });
    }
  }, [group?.id]);

  if (isLoadingGroup) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner size="lg" className="text-indigo-600" />
      </div>
    );
  }

  if (errorGroup || !group) {
    return (
      <ErrorState
        title="Grupo de Autores não encontrado"
        message="Pode ser que este perfil de grupo tenha sido removido ou não exista."
        actionLabel="Voltar ao início"
        onAction={() => window.history.back()}
      />
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      {/* Cabeçalho do Perfil Desktop / Mobile */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className="md:flex">
          {/* Coluna da Foto */}
          <div className="md:w-1/3 lg:w-1/4 bg-gray-50 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 relative">
            <div className="w-40 h-40 md:w-56 md:h-56 flex items-center justify-center relative rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-200">
              {group.photoUrl && !imageError ? (
                <img
                  src={group.photoUrl}
                  alt={group.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <Users className="w-20 h-20 text-gray-400" />
              )}
            </div>
            <Badge variant="outline" className="mt-4 bg-white font-medium capitalize flex items-center gap-1">
              Grupo / Coletivo
            </Badge>
          </div>

          {/* Coluna dos Detalhes Básicos */}
          <div className="md:w-2/3 lg:w-3/4 p-6 lg:p-10 flex flex-col justify-center">
            <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
              {group.name}
            </h1>

            {group.memberNames && group.memberNames.length > 0 && (
              <div className="flex flex-col gap-2 mt-4 text-gray-600">
                <span className="text-sm font-bold uppercase tracking-wider text-gray-400">Membros</span>
                <div className="flex flex-wrap gap-2">
                  {group.memberNames.map((name, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1 font-medium shadow-sm">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna Lateral da Biografia */}
        <div className="lg:col-span-1 space-y-6">
          {group.bio && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-600" /> Sobre o Grupo
              </h3>
              {/* eslint-disable-next-line react/no-danger */}
              <div className="prose prose-sm max-w-none text-gray-600 text-justify" dangerouslySetInnerHTML={{ __html: group.bio }} />
            </div>
          )}
        </div>

        {/* Coluna Principal: Obras */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[500px]">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Briefcase className="w-6 h-6 text-indigo-600" />
                Livros / Trabalhos
              </h2>
              {editionsData && editionsData.data && (
                <Badge variant="secondary" className="bg-gray-100 hover:bg-gray-100 text-gray-700">
                  {editionsData.data.length} edição(ões)
                </Badge>
              )}
            </div>

            {isLoadingEditions ? (
              <div className="flex justify-center items-center py-20">
                <Spinner size="md" className="text-indigo-600" />
              </div>
            ) : editionsData && editionsData.data.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {editionsData.data.map((edition: Edition) => (
                  <Link
                    to={PATHS.BOOK({ editionId: edition.id })}
                    key={edition.id}
                    className="group flex flex-col gap-2"
                  >
                    <div className="aspect-[2/3] w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative group-hover:shadow-lg transition-all duration-300 transform group-hover:-translate-y-1">
                      {edition.coverUrl ? (
                        <img src={edition.coverUrl} alt={edition.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-4">
                          <span className="text-gray-400 text-xs font-medium text-center">{edition.title}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-indigo-600 transition-colors">
                        {edition.title}
                      </h4>
                      {edition.subtitle && (
                        <span className="text-xs text-gray-600 line-clamp-1 italic">{edition.subtitle}</span>
                      )}
                      {edition.publicationDate && (
                        <span className="text-xs text-gray-500 mt-1 capitalize">{formatPublicationDate(edition.publicationDate)}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-gray-900 font-medium text-lg">Nenhum livro cadastrado</h3>
                <p className="text-gray-500 max-w-sm mx-auto mt-2 text-sm">
                  Não encontramos nenhuma edição para o grupo <strong>{group.name}</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
