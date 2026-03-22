import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSeriesAPI } from '@/services/api/booksApi';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageMetadata } from '@/components/seo/PageMetadata';
import { PATHS } from '@/router/paths';
import { ExternalLink, BookOpen, ChevronRight, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getLanguageName, getLanguageFlag } from '@/data/book-languages';
import { getAlternateNameTypeName, getScriptName, sortAlternateNames, getAlternateNamePriority } from '@/data/alternate-names';
import { AlternateName } from '@estante/common-types';

// ─── Sub-componente: Card de série relacionada ────────────────────────────────

const RelatedSeriesCard = ({ seriesId }: { seriesId: string }) => {
    const { data: series } = useQuery({
        queryKey: ['series', seriesId],
        queryFn: () => getSeriesAPI(seriesId),
        enabled: !!seriesId,
    });

    if (!series) return null;

    return (
        <Link to={PATHS.SERIES({ seriesId })} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/50 transition-all group">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 truncate transition-colors">{series.name}</p>
                {series.seriesType && (
                    <Badge variant="outline" className="text-xs mt-1 capitalize">{series.seriesType}</Badge>
                )}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
        </Link>
    );
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export function SeriesPage() {
    const { seriesId } = useParams<{ seriesId: string }>();

    const { data: series, isLoading, error } = useQuery({
        queryKey: ['series', seriesId],
        queryFn: () => getSeriesAPI(seriesId!),
        enabled: !!seriesId,
    });

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Spinner size="lg" className="text-indigo-600" />
            </div>
        );
    }

    if (error || !series) {
        return (
            <ErrorState
                title="Série não encontrada"
                message="Pode ser que esta série tenha sido removida ou não exista."
                actionLabel="Voltar"
                onAction={() => window.history.back()}
            />
        );
    }

    const hasAlternateNames = series.alternateNames && series.alternateNames.length > 0;

    // Extrair os livros da série a partir dos works que referenciam esta série
    // (buscamos no futuro via endpoint dedicado; por ora usamos relatedSeriesIds como exemplo)
    const relatedSeriesIds = series.relatedSeriesIds || [];

    return (
        <>
            <PageMetadata
                title={`${series.name} | Estante de Bolso`}
                description={series.description || `Detalhes da série ${series.name} na Estante de Bolso.`}
            />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">

                {/* ─── Cabeçalho da Série ─────────────────────────────── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8 mb-8">
                    <div className="flex items-start gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap mb-2">
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{series.name}</h1>
                                {series.seriesType && (
                                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 capitalize text-xs font-bold">
                                        {series.seriesType}
                                    </Badge>
                                )}
                            </div>

                            {/* Nomes alternativos (Inline resumido se houver) */}
                            {hasAlternateNames && (
                                <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-gray-500 mb-3">
                                    {series.alternateNames!.slice(0, 3).map((alt, i) => (
                                        <span key={i} className="bg-gray-50 px-2 py-0.5 rounded border border-gray-100 flex items-center gap-1">
                                            {alt.language && <span className="text-[10px]">{getLanguageFlag(alt.language)}</span>}
                                            <span className="font-medium text-gray-700">{alt.value}</span>
                                        </span>
                                    ))}
                                    {series.alternateNames!.length > 3 && <span>...</span>}
                                </div>
                            )}

                            {series.primaryAuthors && series.primaryAuthors.length > 0 && (
                                <p className="text-sm text-gray-500">
                                    por {series.primaryAuthors.map((author, idx) => (
                                        <span key={author.id}>
                                            <Link 
                                                to={author.type === 'person' ? PATHS.AUTHOR({ personId: author.id }) : PATHS.GROUP({ groupId: author.id })}
                                                className="font-semibold text-gray-700 hover:text-indigo-600 transition-colors"
                                            >
                                                {author.name}
                                            </Link>
                                            {idx < series.primaryAuthors.length - 1 && ', '}
                                        </span>
                                    ))}
                                </p>
                            )}

                            {series.description && (
                                <p className="text-sm text-gray-600 mt-4 leading-relaxed max-w-2xl">{series.description}</p>
                            )}
                        </div>
                    </div>

                    {/* Links externos */}
                    {series.externalLinks && series.externalLinks.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-gray-50">
                            {series.externalLinks.map((link, i) => (
                                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-700 rounded-full text-xs font-medium transition-colors border border-gray-200 hover:border-indigo-200 capitalize">
                                    <ExternalLink className="w-3 h-3" />
                                    {link.source}
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Layout 2 colunas ───────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Coluna principal: Livros da série */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-emerald-600" />
                            Livros da Série
                            {series.totalBooks && (
                                <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 ml-1">{series.totalBooks} volumes</Badge>
                            )}
                        </h2>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            {/* Placeholder até haver endpoint de volumes por série */}
                            <div className="text-center py-12 text-gray-400">
                                <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Os volumes desta série aparecerão aqui em breve.</p>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar: Séries relacionadas */}
                    <div className="space-y-6">
                        {relatedSeriesIds.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Séries Relacionadas</h3>
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2 space-y-1">
                                    {relatedSeriesIds.map(id => (
                                        <RelatedSeriesCard key={id} seriesId={id} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Detalhes Regionais */}
                        {hasAlternateNames && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-indigo-600" /> Detalhes Regionais
                                </h3>
                                <div className="space-y-3">
                                    {Object.entries(
                                        sortAlternateNames(series.alternateNames!).reduce((acc, alt) => {
                                            const typeKey = alt.type || 'other';
                                            if (!acc[typeKey]) acc[typeKey] = [];
                                            acc[typeKey].push(alt);
                                            return acc;
                                        }, {} as Record<string, AlternateName[]>)
                                    ).sort((a, b) => getAlternateNamePriority(a[0]) - getAlternateNamePriority(b[0]))
                                     .map(([type, names]) => (
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
                            </div>
                        )}

                        {/* Stats */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Informações</h3>
                            <dl className="space-y-2 text-sm">
                                {series.totalBooks && (
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500">Total de volumes</dt>
                                        <dd className="font-semibold text-gray-900">{series.totalBooks}</dd>
                                    </div>
                                )}
                                {series.seriesType && (
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500">Formato</dt>
                                        <dd className="font-semibold text-gray-900 capitalize">{series.seriesType}</dd>
                                    </div>
                                )}
                                {series.originalSeriesId && (
                                    <div className="flex justify-between items-center">
                                        <dt className="text-gray-500">Série derivada de</dt>
                                        <dd>
                                            <Link to={PATHS.SERIES({ seriesId: series.originalSeriesId })}
                                                className="text-indigo-600 hover:text-indigo-700 font-medium text-xs">
                                                Ver original →
                                            </Link>
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
