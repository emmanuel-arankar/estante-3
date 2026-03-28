import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSuggestionsAdminAPI,
  ContentSuggestion,
  ListSuggestionsParams,
} from '@/features/books/services/suggestionsApi';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import { SuggestionReviewModal } from './SuggestionReviewModal';
import { BookOpen, User, Library, AlertCircle, CheckCircle, XCircle, Clock, Filter, RefreshCw } from 'lucide-react';

const TYPE_LABELS: Record<ContentSuggestion['type'], string> = {
  work: 'Obra',
  edition: 'Edição',
  person: 'Pessoa',
  group: 'Grupo',
  publisher: 'Editora',
  series: 'Série',
  genre: 'Gênero',
  format: 'Formato',
  correction: 'Correção',
};

const STATUS_CONFIG = {
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  approved: { label: 'Aprovado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle },
  rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

const TYPE_ICON_MAP: Record<string, any> = {
  work: BookOpen, edition: BookOpen, person: User,
  group: User, publisher: Library, series: BookOpen,
  default: AlertCircle,
};

export function SuggestionsQueue() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ListSuggestionsParams>({ status: 'pending', page: 1, limit: 20 });
  const [selected, setSelected] = useState<ContentSuggestion | null>(null);

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['admin-suggestions', filters],
    queryFn: () => listSuggestionsAdminAPI(filters),
    staleTime: 30_000,
  });

  const suggestions = data?.data ?? [];
  const pagination = data?.pagination;

  const handleReviewed = () => {
    setSelected(null);
    queryClient.invalidateQueries({ queryKey: ['admin-suggestions'] });
    queryClient.invalidateQueries({ queryKey: ['works'] });
    queryClient.invalidateQueries({ queryKey: ['editions'] });
    queryClient.invalidateQueries({ queryKey: ['editions-carousel'] });
    queryClient.invalidateQueries({ queryKey: ['persons'] });
    queryClient.invalidateQueries({ queryKey: ['publishers'] });
  };


  return (
    <>
      <div className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex gap-2 flex-wrap">
            {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilters(f => ({ ...f, status: s, page: 1 }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filters.status === s
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-emerald-300'
                  }`}
              >
                {s === 'all' ? 'Todas' : STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>

          <select
            value={filters.type ?? ''}
            onChange={e => setFilters(f => ({ ...f, type: (e.target.value as any) || undefined, page: 1 }))}
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
            <span className="font-semibold text-gray-700">{pagination.total}</span> sugestões encontradas
          </p>
        )}

        {/* Lista */}
        {isError ? (
          <div className="text-center py-12 bg-red-50 rounded-2xl border border-red-100 shadow-sm animate-in fade-in zoom-in duration-300">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-red-900 font-bold text-lg">Ops! Algo deu errado</p>
            <p className="text-red-600/70 text-sm mt-1 max-w-xs mx-auto">{(error as any)?.message ?? 'Tente novamente clicando em atualizar.'}</p>
            <button
              onClick={() => refetch()}
              className="mt-6 px-6 py-2 bg-red-600 text-white rounded-full text-sm font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
            >
              Tentar novamente
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <Spinner size="lg" className="text-emerald-600 mb-4" />
            <p className="text-gray-400 text-sm font-medium">Carregando sugestões...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-100 animate-in fade-in duration-500">
            <div className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <p className="text-gray-900 font-bold text-lg">Nada por aqui!</p>
            <p className="text-gray-400 text-sm mt-1">Todas as sugestões foram revisadas ou não há envios recentes.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {suggestions.map(s => {
              const status = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] hover:border-emerald-200 transition-all duration-300 p-5 group relative overflow-hidden active:scale-[0.99]"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 text-gray-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all duration-300">
                      {(() => {
                        const Icon = TYPE_ICON_MAP[s.type] ?? TYPE_ICON_MAP.default;
                        return <Icon className="w-6 h-6" />;
                      })()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded-md group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                          {TYPE_LABELS[s.type] ?? s.type}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${status.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label.toUpperCase()}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-gray-900 truncate leading-tight group-hover:text-emerald-700 transition-colors">
                        {s.data?.title ?? s.data?.name ?? (s as any).title ?? (s as any).name ?? s.targetEntityId ?? 'Sem título'}
                      </h3>

                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                          <User className="w-3.5 h-3.5" />
                          <span>Envio da Comunidade</span>
                        </div>
                        <span className="text-gray-200">•</span>
                        {s.type === 'correction' && s.corrections && (
                          <p className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                            {s.corrections.length} campos alterados
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-gray-300 uppercase letter-spacing-wider group-hover:text-gray-400 transition-colors">
                        <Clock className="w-3 h-3" />
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                          : '—'
                        }
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                      </div>
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
              disabled={filters.page === 1}
              onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}>
              ← Anterior
            </Button>
            <span className="text-sm text-gray-500">
              Página {filters.page} de {pagination.totalPages}
            </span>
            <Button variant="outline" size="sm"
              disabled={filters.page === pagination.totalPages}
              onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}>
              Próxima →
            </Button>
          </div>
        )}

      </div>

      {/* Modal de revisão - fora do container de espaçamento para evitar glitches */}
      {selected && (
        <SuggestionReviewModal
          suggestion={selected}
          onClose={() => setSelected(null)}
          onReviewed={handleReviewed}
        />
      )}
    </>
  );
}
