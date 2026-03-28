import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    listSuggestionsAdminAPI,
    ContentSuggestion,
} from '@/features/books/services/suggestionsApi';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import { SuggestionReviewModal } from './SuggestionReviewModal';
import {
    BookOpen, User, Library, AlertCircle,
    CheckCircle, XCircle, Filter, Clock, MessageSquare, RefreshCw
} from 'lucide-react';

const TYPE_LABELS: Record<ContentSuggestion['type'], string> = {
    work: 'Obra', edition: 'Edição', person: 'Pessoa',
    group: 'Grupo', publisher: 'Editora', series: 'Série',
    genre: 'Gênero', format: 'Formato', correction: 'Correção',
};

const TYPE_ICON_MAP: Record<string, any> = {
    work: BookOpen, edition: BookOpen, person: User,
    group: User, publisher: Library, series: BookOpen,
    default: AlertCircle,
};

function formatDate(date?: Date | string) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

function formatRelativeTime(date?: Date | string) {
    if (!date) return '';
    const now = new Date();
    const d = new Date(date);
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    if (days < 30) return `${days} dias atrás`;
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? 'mês' : 'meses'} atrás`;
}

type StatusFilter = 'all' | 'approved' | 'rejected';

export function DecisionHistory() {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [typeFilter, setTypeFilter] = useState<ContentSuggestion['type'] | ''>('');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<ContentSuggestion | null>(null);

    const apiStatus = statusFilter === 'all' ? 'all' : statusFilter;

    const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
        queryKey: ['decision-history', statusFilter, typeFilter, page],
        queryFn: () => listSuggestionsAdminAPI({
            status: apiStatus,
            type: typeFilter || undefined,
            page,
            limit: 20,
        }),
        staleTime: 60_000,
        select: (res) => ({
            ...res,
            // Filtrar apenas resolvidas (approved ou rejected)
            data: res.data.filter(s => s.status === 'approved' || s.status === 'rejected'),
        }),
    });

    const suggestions = data?.data ?? [];
    const pagination = data?.pagination;

    return (
        <>
            <div className="space-y-4">
                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <Filter className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex gap-2 flex-wrap">
                        {(['all', 'approved', 'rejected'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => { setStatusFilter(s); setPage(1); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    statusFilter === s
                                        ? s === 'approved'
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : s === 'rejected'
                                                ? 'bg-red-500 text-white border-red-500'
                                                : 'bg-gray-800 text-white border-gray-800'
                                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'
                                }`}
                            >
                                {s === 'all' ? 'Todas' : s === 'approved' ? 'Aprovadas' : 'Rejeitadas'}
                            </button>
                        ))}
                    </div>

                    <select
                        value={typeFilter}
                        onChange={e => { setTypeFilter(e.target.value as any); setPage(1); }}
                        className="ml-auto text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                        <option value="">Todos os tipos</option>
                        {Object.entries(TYPE_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => refetch()}
                        className="text-gray-400 hover:text-emerald-600 transition-colors"
                        title="Atualizar"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Contador */}
                {pagination && (
                    <p className="text-sm text-gray-500 px-1">
                        <span className="font-semibold text-gray-700">{pagination.total}</span> decisões encontradas
                    </p>
                )}

                {/* Lista */}
                {isError ? (
                    <div className="text-center py-12 bg-red-50 rounded-2xl border border-red-100">
                        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                        <p className="text-red-900 font-bold">Erro ao carregar histórico</p>
                        <p className="text-red-600/70 text-sm mt-1">{(error as any)?.message}</p>
                        <button
                            onClick={() => refetch()}
                            className="mt-4 px-5 py-2 bg-red-600 text-white rounded-full text-sm font-bold hover:bg-red-700 transition-colors"
                        >
                            Tentar novamente
                        </button>
                    </div>
                ) : isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                        <Spinner size="lg" className="text-emerald-600 mb-4" />
                        <p className="text-gray-400 text-sm font-medium">Carregando histórico...</p>
                    </div>
                ) : suggestions.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-100">
                        <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Clock className="w-10 h-10 text-gray-200" />
                        </div>
                        <p className="text-gray-900 font-bold text-lg">Nenhuma decisão ainda</p>
                        <p className="text-gray-400 text-sm mt-1">Nenhuma sugestão foi revisada com os filtros selecionados.</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {suggestions.map(s => {
                            const isApproved = s.status === 'approved';
                            const TypeIcon = TYPE_ICON_MAP[s.type] ?? TYPE_ICON_MAP.default;
                            const title = s.data?.title ?? s.data?.name ?? (s as any).title ?? (s as any).name ?? s.targetEntityId ?? 'Sem título';

                            return (
                                <button
                                    key={s.id}
                                    onClick={() => setSelected(s)}
                                    className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] hover:border-gray-200 transition-all duration-300 p-5 group relative overflow-hidden active:scale-[0.99]"
                                >
                                    {/* Barra lateral colorida */}
                                    <div className={`absolute top-0 left-0 w-1 h-full transition-opacity ${isApproved ? 'bg-emerald-400' : 'bg-red-400'} opacity-60 group-hover:opacity-100`} />

                                    <div className="flex items-start gap-4">
                                        {/* Ícone do tipo */}
                                        <div className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 text-gray-400 group-hover:bg-gray-100 transition-all">
                                            <TypeIcon className="w-5 h-5" />
                                        </div>

                                        {/* Conteúdo principal */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded-md">
                                                    {TYPE_LABELS[s.type] ?? s.type}
                                                </span>
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                                    isApproved
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                    {isApproved
                                                        ? <><CheckCircle className="w-3 h-3" /> APROVADA</>
                                                        : <><XCircle className="w-3 h-3" /> REJEITADA</>
                                                    }
                                                </span>
                                            </div>

                                            <h3 className="text-base font-bold text-gray-900 truncate leading-tight">
                                                {title}
                                            </h3>

                                            {/* Nota de justificativa */}
                                            {s.reviewNote && (
                                                <div className="mt-2 flex items-start gap-1.5">
                                                    <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                                                    <p className="text-xs text-gray-500 italic line-clamp-2">
                                                        "{s.reviewNote}"
                                                    </p>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                {/* Data da resolução */}
                                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>{formatDate(s.resolvedAt || s.createdAt)}</span>
                                                    <span className="text-gray-300 ml-1">
                                                        {formatRelativeTime(s.resolvedAt || s.createdAt)}
                                                    </span>
                                                </div>

                                                {/* Revisor */}
                                                {s.reviewedBy && (
                                                    <>
                                                        <span className="text-gray-200">•</span>
                                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                                            <User className="w-3.5 h-3.5" />
                                                            <span>por <span className="font-semibold text-gray-600">{s.reviewedByRole ?? s.reviewedBy}</span></span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Indicador visual de status no canto */}
                                        <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                                            isApproved ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                                        }`}>
                                            {isApproved
                                                ? <CheckCircle className="w-5 h-5" />
                                                : <XCircle className="w-5 h-5" />
                                            }
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Paginação */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                        <Button variant="outline" size="sm"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}>
                            ← Anterior
                        </Button>
                        <span className="text-sm text-gray-500">
                            Página {page} de {pagination.totalPages}
                        </span>
                        <Button variant="outline" size="sm"
                            disabled={page === pagination.totalPages}
                            onClick={() => setPage(p => p + 1)}>
                            Próxima →
                        </Button>
                    </div>
                )}
            </div>

            {selected && (
                <SuggestionReviewModal
                    suggestion={selected}
                    onClose={() => setSelected(null)}
                    onReviewed={() => setSelected(null)}
                />
            )}
        </>
    );
}
