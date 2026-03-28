
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Globe, Info, ExternalLink, Calendar, Edit3 } from 'lucide-react';
import { getPersonAPI, getPersonEditionsAPI } from '@/features/books/services/booksApi';
import { PATHS } from '@/router/paths';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Edition } from '@estante/common-types';
import { formatPublicationDate } from '@/lib/utils';
import { getLanguageName, getLanguageFlag } from '@/data/book-languages';
import { getContributorRoleName } from '@/data/book-contributors';
import { getAlternateNameTypeName, getScriptName } from '@/data/alternate-names';
import { AlternateName } from '@estante/common-types';
import { useState, useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function PersonPage() {
  const { isAdmin, isLibrarian } = useAuth();
  const { personId } = useParams();
  const page = 1; // Temporário até implementar páginação real
  const [imageError, setImageError] = useState(false);

  // Fetch details
  const { data: person, isLoading: isLoadingPerson, error: errorPerson } = useQuery({
    queryKey: ['person', personId],
    queryFn: () => getPersonAPI(personId!),
    enabled: !!personId,
  });

  // Fetch editions
  const { data: editionsData, isLoading: isLoadingEditions } = useQuery({
    queryKey: ['person', personId, 'editions', page],
    queryFn: () => getPersonEditionsAPI(personId!, page, 24),
    enabled: !!personId,
  });

  // Compute derived properties
  const hasAlternateNames = person?.alternateNames && person.alternateNames.length > 0;
  const hasEncyclopediaLinks = person?.encyclopediaLinks && person.encyclopediaLinks.length > 0;
  const hasSocialLinks = person?.socialLinks && person.socialLinks.length > 0;

  // Rastrear visualização do perfil do autor
  useEffect(() => {
    if (person?.id) {
      trackEvent('author_viewed', { person_id: person.id, name: person.name, type: 'person' });
    }
  }, [person?.id]);

  if (isLoadingPerson) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner size="lg" className="text-emerald-600" />
      </div>
    );
  }

  if (errorPerson || !person) {
    return (
      <ErrorState
        title="Autor(a) não encontrado(a)"
        message="Pode ser que este perfil de talento tenha sido removido ou não exista."
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
              {person.photoUrl && !imageError ? (
                <img
                  src={person.photoUrl}
                  alt={person.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-200 text-gray-400">
                  <Globe className="w-16 h-16 opacity-50" />
                </div>
              )}
            </div>
            {person.nationality && (
              <Badge variant="outline" className="mt-4 bg-white font-medium capitalize flex items-center gap-1">
                <span className="mr-1">{getLanguageFlag(person.nationality)}</span>
                {getLanguageName(person.nationality)}
              </Badge>
            )}
          </div>

          {/* Coluna dos Detalhes Básicos */}
          <div className="md:w-2/3 lg:w-3/4 p-6 lg:p-10 flex flex-col justify-center">
            <div className="flex items-center flex-wrap gap-3">
              <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
                {person.name}
              </h1>
              {(isAdmin || isLibrarian) && (
                <Link
                  to={PATHS.CURATOR_EDIT_PERSON({ personId: person.id })}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-full transition-colors shadow-sm mt-1 sm:mt-0"
                  title="Editar Autor (Admin)"
                >
                  <Edit3 className="w-4 h-4" />
                </Link>
              )}
            </div>

            {(person.birthDate || person.deathDate) && (
              <div className="flex items-center text-sm md:text-base text-gray-500 mt-3 font-medium">
                <Calendar className="w-4 h-4 mr-2 text-emerald-600" />
                {person.birthDate ? new Date(person.birthDate).getFullYear() : '?'}
                {' - '}
                {person.deathDate ? new Date(person.deathDate).getFullYear() : 'Presente'}
              </div>
            )}

            {/* Social Links Rápidos */}
            {(hasSocialLinks || person.website) && (
              <div className="flex flex-wrap gap-3 mt-6">
                {person.website && (
                  <a href={person.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-full text-sm font-medium transition-colors border border-gray-200">
                    <Globe className="w-4 h-4 text-gray-500" /> Site Oficial
                  </a>
                )}
                {person.socialLinks?.map((link, idx) => (
                  <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-full text-sm font-medium transition-colors border border-gray-200 capitalize">
                    <ExternalLink className="w-4 h-4 text-gray-500" /> {link.platform}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna Lateral da Biografia */}
        <div className="lg:col-span-1 space-y-6">
          {person.bio && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-emerald-600" /> Biografia
              </h3>
              {/* eslint-disable-next-line react/no-danger */}
              <div className="prose prose-sm max-w-none text-gray-600 text-justify hyphens-auto" dangerouslySetInnerHTML={{ __html: person.bio }} />
            </div>
          )}

          {/* Meta-dados Adicionais (Nomes Alternativos, Encyclopedia) */}
          {(hasAlternateNames || hasEncyclopediaLinks) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-sm text-gray-700">
              <h3 className="text-lg font-bold text-gray-900 mb-6 pb-2 border-b border-gray-50 flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-600" /> Detalhes Regionais
              </h3>

              <div className="space-y-6">
                {hasAlternateNames && (
                  <div className="space-y-3">
                    {Object.entries(
                      person.alternateNames!.reduce((acc, alt) => {
                        const typeKey = alt.type || 'other';
                        if (!acc[typeKey]) acc[typeKey] = [];
                        acc[typeKey].push(alt);
                        return acc;
                      }, {} as Record<string, AlternateName[]>)
                    ).map(([type, names]) => (
                      <div key={type} className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">
                          {getAlternateNameTypeName(type)}
                        </span>
                        <div className="space-y-2">
                          {names.map((alt, idx) => (
                            <div key={idx} className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-gray-800">
                                {alt.value}
                              </span>
                              {(alt.language || alt.script) && (
                                <span className="text-gray-400 font-medium text-[10px] bg-white px-1.5 py-0.5 rounded border border-gray-100 shadow-sm whitespace-nowrap">
                                  {[
                                    alt.language ? getLanguageName(alt.language) : '',
                                    alt.script ? getScriptName(alt.script, alt.language) : ''
                                  ].filter(Boolean).join(', ').toLowerCase()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {hasEncyclopediaLinks && (
                  <div className="space-y-3 pt-2 border-t border-gray-50">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Referências Externas</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {person.encyclopediaLinks!.map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-white hover:border-emerald-200 hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-center gap-2">
                            {link.language && <span className="text-lg">{getLanguageFlag(link.language)}</span>}
                            <span className="text-sm font-semibold text-gray-700 group-hover:text-emerald-600 transition-colors capitalize">
                              {link.source} {link.language && <span className="text-gray-400 font-normal text-xs ml-1">({getLanguageName(link.language)})</span>}
                            </span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Coluna Principal: Obras */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[500px]">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Briefcase className="w-6 h-6 text-emerald-600" />
                Livros / Trabalhos
              </h2>
              {editionsData?.pagination && (
                <Badge variant="secondary" className="bg-gray-100 hover:bg-gray-100 text-gray-700">
                  {editionsData.pagination.total} edição(ões)
                </Badge>
              )}
            </div>

            {isLoadingEditions ? (
              <div className="flex justify-center items-center py-20">
                <Spinner size="md" className="text-emerald-600" />
              </div>
            ) : editionsData && editionsData.data.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6">
                {editionsData.data.map((edition: Edition) => (
                  <Link
                    to={PATHS.BOOK({ editionId: edition.id })}
                    key={edition.id}
                    className="group flex flex-col gap-2"
                  >
                    {/* Zona de Capa Compacta com Alinhamento na Base */}
                    <div className="w-full h-[265px] flex flex-col justify-end">
                      <div className="w-full bg-gray-100 rounded-lg border border-gray-200 relative group-hover:shadow-lg transition-all duration-300 transform group-hover:-translate-y-1">
                        {edition.coverUrl ? (
                          <img src={edition.coverUrl} alt={edition.title} className="w-full h-auto rounded-lg" />
                        ) : (
                          <div className="aspect-[2/3] w-full flex items-center justify-center p-4">
                            <span className="text-gray-400 text-xs font-medium text-center">{edition.title}</span>
                          </div>
                        )}
                        {/* Role badge (over the cover) */}
                        {edition.contributors && (
                          (() => {
                            const role = edition.contributors.find(c => c.personId === personId)?.role;
                            if (!role) return null;
                            const isMainAuthor = role === 'author' || role === 'co-author';
                            const displayRole = getContributorRoleName(role);
                            return (
                              <div className={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm ${isMainAuthor ? 'bg-emerald-600 text-white' : 'bg-white/90 text-gray-700 border border-gray-100'}`}>
                                {displayRole}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col mt-2 space-y-0.5">
                      <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-emerald-600 transition-colors">
                        {edition.title}
                      </h4>
                      {edition.subtitle && (
                        <span className="text-xs text-gray-600 line-clamp-1 italic">{edition.subtitle}</span>
                      )}
                      {edition.publicationDate && (
                        <span className="text-xs text-gray-500">{formatPublicationDate(edition.publicationDate)}</span>
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
                  Não encontramos nenhuma edição onde <strong>{person.name}</strong> seja listado(a) como contribuidor(a).
                </p>
              </div>
            )}

            {/* Fake Pagination for Demo */}
            {editionsData?.pagination && editionsData.pagination.totalPages > 1 && (
              <div className="mt-10 flex justify-center">
                <Badge variant="secondary" className="px-4 py-1.5 cursor-pointer">Carregar mais</Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
