
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Globe, Info, ExternalLink, Calendar, MapPin } from 'lucide-react';
import { getPersonAPI, getPersonEditionsAPI } from '@/services/booksApi';
import { PATHS } from '@/router/paths';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Edition } from '@estante/common-types';
import { formatPublicationDate } from '@/lib/utils';
import { getLanguageName, getLanguageFlag } from '@/data/book-languages';
import { getContributorRoleName } from '@/data/book-contributors';
import { useState, useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

export function PersonDetail() {
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
                        <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
                            {person.name}
                        </h1>

                        {(person.birthDate || person.deathDate) && (
                            <div className="flex items-center text-sm md:text-base text-gray-500 mt-3 font-medium">
                                <Calendar className="w-4 h-4 mr-2 text-emerald-600" />
                                {person.birthDate ? new Date(person.birthDate).getFullYear() : '?'}
                                {' - '}
                                {person.deathDate ? new Date(person.deathDate).getFullYear() : 'Presente'}
                            </div>
                        )}

                        {/* Nomes Alternativos e Wikipedia - Layout Restorado */}
                        {(hasAlternateNames || hasEncyclopediaLinks) && (
                            <div className="mt-5 flex flex-col gap-2">
                                {hasAlternateNames && (
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest mr-1">Conhecido também como:</span>
                                        {person.alternateNames!.map((alt, idx) => (
                                            <span key={idx} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium border border-indigo-100">
                                                {alt.value} 
                                                {alt.language || alt.country || alt.script || alt.type ? ` (${[alt.language, alt.country, alt.script, alt.type].filter(Boolean).join('-')})` : ''}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {hasEncyclopediaLinks && (
                                    <div className="flex flex-wrap gap-3 items-center mt-1">
                                        {person.encyclopediaLinks!.map((link, i) => (
                                            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 text-sm font-medium capitalize">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                {link.source} {link.language && `(${link.language})`}
                                            </a>
                                        ))}
                                    </div>
                                )}
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
                                        <div className="aspect-[2/3] w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative group-hover:shadow-lg transition-all duration-300 transform group-hover:-translate-y-1">
                                            {edition.coverUrl ? (
                                                <img src={edition.coverUrl} alt={edition.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center p-4">
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
                                                        <div className={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm ${isMainAuthor ? 'bg-emerald-600 text-white' : 'bg-white/90 text-gray-700 border border-gray-200'}`}>
                                                            {displayRole}
                                                        </div>
                                                    );
                                                })()
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-emerald-600 transition-colors">
                                                {edition.title}
                                            </h4>
                                            {edition.subtitle && (
                                                <span className="text-xs text-gray-600 line-clamp-1 italic">{edition.subtitle}</span>
                                            )}
                                            {edition.publicationDate && (
                                                <span className="text-xs text-gray-500 mt-1">{formatPublicationDate(edition.publicationDate)}</span>
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
