import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getWorkEditionsFilteredAPI, getWorkAPI, createReviewAPI } from '@/features/books/services/booksApi';
import { Edition } from '@estante/common-types';
import { PATHS } from '@/router/paths';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ShelfButton } from '@/features/books/components/ShelfButton';
import { StarRating } from '@/features/books/components/StarRating';
import { getLanguageName, getLanguageFlag } from '@/data/book-languages';
import { getFormatById } from '@/data/book-formats';
import { formatPublicationDate } from '@/lib/utils';
import { formatISBN } from '@/lib/isbn';
import { PageMetadata } from '@/common/PageMetadata';
import { ChevronRight, Home, Book, Layers, ArrowDownAZ, ArrowDownZA } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { itemVariants, SMOOTH_TRANSITION } from '@/lib/animations';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbList,
} from '@/components/ui/breadcrumb';

interface Filters {
  language: string;
  formatId: string;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  page: number;
}

export function EditionsPage() {
  const { workId } = useParams<{ workId: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fromEditionId = searchParams.get('from');

  const [filters, setFilters] = useState<Filters>({
    language: '',
    formatId: '',
    sortBy: 'date_published',
    sortDirection: 'desc',
    page: 1
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data: work } = useQuery({
    queryKey: ['work', workId],
    queryFn: () => getWorkAPI(workId!),
    enabled: !!workId,
  });

  const { data: editions, isLoading } = useQuery({
    queryKey: ['editions', workId, filters],
    queryFn: () => getWorkEditionsFilteredAPI(workId!, {
      language: filters.language || undefined,
      formatId: filters.formatId || undefined,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      page: filters.page,
      limit: 20,
    }),
    enabled: !!workId,
  });

  const availableLanguages = editions?.data
    ? Array.from(new Set(editions.data.map(e => e.language))).filter(Boolean)
    : [];

  const availableFormats = editions?.data
    ? Array.from(new Set(editions.data.map(e => e.formatId))).filter(Boolean)
    : [];

  const setFilter = (key: keyof Omit<Filters, 'page'>, value: string) => {
    setFilters(f => ({ ...f, [key]: value, page: 1 }));
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (expand: boolean) => {
    if (expand && editions?.data) {
      setExpandedItems(new Set(editions.data.map(e => e.id)));
    } else {
      setExpandedItems(new Set());
    }
  };

  const handleRate = async (editionId: string, rating: number) => {
    if (!user) {
      toastErrorClickable('Faça login para avaliar uma edição.');
      return;
    }
    try {
      await createReviewAPI({
        editionId,
        workId: workId!,
        rating,
        content: '',
        containsSpoiler: false
      });
      queryClient.invalidateQueries({ queryKey: ['editions'] });
      toastSuccessClickable('Avaliação registrada!');
    } catch (err) {
      toastErrorClickable('Erro ao avaliar. Tente na página do livro.');
    }
  };

  const allExpanded = editions?.data && editions.data.length > 0 && expandedItems.size === editions.data.length;

  return (
    <>
      <PageMetadata
        title={`Todas as edições — ${work?.title || 'Livro'} | Estante de Bolso`}
        description={`Lista completa de edições cadastradas para ${work?.title || 'esta obra'}.`}
      />
      <div className="max-w-7xl mx-auto px-4">
        <Breadcrumb className="hidden md:flex mt-4 mb-2">
          <BreadcrumbList>
            <motion.li key="home" variants={itemVariants} initial="hidden" animate="visible" className="inline-flex items-center gap-1.5" transition={SMOOTH_TRANSITION}>
              <Link to={PATHS.HOME} aria-label="Página Inicial" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
                <Home className="h-4 w-4 text-gray-500" />
              </Link>
            </motion.li>
            <motion.li key="sep1" variants={itemVariants} transition={SMOOTH_TRANSITION} className="inline-flex items-center text-gray-300">
              <ChevronRight className="h-3.5 w-3.5" />
            </motion.li>
            <motion.li key="work" variants={itemVariants} transition={{ ...SMOOTH_TRANSITION, delay: 0.08 }} className="inline-flex items-center gap-1.5">
              <Link to={fromEditionId ? PATHS.BOOK({ editionId: fromEditionId }) : PATHS.WORK({ workId: work?.id || '' })} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium text-gray-500">
                < Book className="h-4 w-4" />
                {work?.title || 'Livro'}
              </Link>
            </motion.li>
            <motion.li key="sep2" variants={itemVariants} transition={{ ...SMOOTH_TRANSITION, delay: 0.16 }} className="inline-flex items-center text-gray-300">
              <ChevronRight className="h-3.5 w-3.5" />
            </motion.li>
            <motion.li key="editions" variants={itemVariants} transition={{ ...SMOOTH_TRANSITION, delay: 0.24 }} className="inline-flex items-center gap-1.5">
              <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-foreground">
                <Layers className="h-4 w-4" />
                Edições
              </div>
            </motion.li>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8 animate-in fade-in duration-500">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Edições de {work?.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
            {work?.primaryAuthors && (
              <p>
                por {work.primaryAuthors.map((author, idx) => (
                  <span key={author.id}>
                    <Link to={PATHS.AUTHOR({ personId: author.id })} className="text-emerald-600 font-medium hover:underline">
                      {author.name}
                    </Link>
                    {idx < work.primaryAuthors.length - 1 && ', '}
                  </span>
                ))}
              </p>
            )}
            {work?.originalPublicationDate && (
              <p className="border-l border-gray-300 pl-3">
                Primeira publicação em {new Date(work.originalPublicationDate).toLocaleDateString('pt-BR', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
            <button
              onClick={() => toggleAll(!allExpanded)}
              className="ml-auto text-[11px] font-bold text-emerald-600 hover:underline uppercase tracking-wider"
            >
              {allExpanded ? 'colapsar todos os detalhes' : 'expandir todos os detalhes'}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end gap-6 py-4 border-y border-gray-100 mb-6 font-geist">
          <div className="flex flex-col gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">idioma</span>
            <Select value={filters.language || 'all'} onValueChange={(val: string) => setFilter('language', val === 'all' ? '' : val)}>
              <SelectTrigger className="w-full sm:w-[220px] h-8 bg-white border-gray-200 text-[13px] font-medium px-3 shadow-none focus:ring-1 focus:ring-emerald-500">
                <SelectValue placeholder="Todos os idiomas" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 shadow-lg">
                <SelectItem value="all" className="text-[13px]">Todos os idiomas</SelectItem>
                {availableLanguages.map(langCode => (
                  <SelectItem key={langCode} value={langCode} className="text-[13px]">
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>{getLanguageName(langCode)}</span>
                      <span className="opacity-80 text-[1.1em] leading-none">{getLanguageFlag(langCode)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">formato</span>
            <Select value={filters.formatId || 'all'} onValueChange={(val: string) => setFilter('formatId', val === 'all' ? '' : val)}>
              <SelectTrigger className="w-full sm:w-[180px] h-8 bg-white border-gray-200 text-[13px] font-medium px-3 shadow-none focus:ring-1 focus:ring-emerald-500">
                <SelectValue placeholder="Todos os formatos" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 shadow-lg">
                <SelectItem value="all" className="text-[13px]">Todos os formatos</SelectItem>
                {availableFormats.map(fmtId => (
                  <SelectItem key={fmtId} value={fmtId} className="text-[13px]">
                    {getFormatById(fmtId)?.name || 'Outro'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">ordenar por</span>
            <div className="flex items-center gap-2">
              <Select value={filters.sortBy} onValueChange={(val: string) => setFilter('sortBy', val)}>
                <SelectTrigger className="w-full sm:w-[220px] h-8 bg-white border-gray-200 text-[13px] font-medium px-3 shadow-none focus:ring-1 focus:ring-emerald-500">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-lg">
                  <SelectItem value="date_published" className="text-[13px]">Data de publicação</SelectItem>
                  <SelectItem value="title" className="text-[13px]">Título</SelectItem>
                  <SelectItem value="avg_rating" className="text-[13px]">Avaliação média</SelectItem>
                  <SelectItem value="num_ratings" className="text-[13px]">Número de avaliações</SelectItem>
                  <SelectItem value="format" className="text-[13px]">Formato</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-white border-gray-200 text-gray-500 hover:text-emerald-600 hover:border-emerald-200 shadow-none"
                onClick={() => setFilters(prev => ({ ...prev, sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc' }))}
                title={filters.sortDirection === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
              >
                {filters.sortDirection === 'asc' ? <ArrowDownAZ size={16} /> : <ArrowDownZA size={16} />}
              </Button>
            </div>
          </div>

          {(filters.language || filters.formatId || filters.sortBy !== 'date_published' || filters.sortDirection !== 'desc') && (
            <button
              onClick={() => setFilters({ language: '', formatId: '', sortBy: 'date_published', sortDirection: 'desc', page: 1 })}
              className="h-8 text-[12px] font-bold text-gray-400 hover:text-emerald-600 transition-colors px-2"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <LoadingSpinner size="lg" className="text-emerald-600" />
          </div>
        ) : editions && editions.data.length > 0 ? (
          <div className="space-y-8">
            {editions.data.map((edition: Edition) => {
              const isExpanded = expandedItems.has(edition.id);
              const formatName = getFormatById(edition.formatId!)?.name || 'Vários';

              // Extração segura do selo editorial (imprint)
              const imprintName = typeof edition.imprint === 'object'
                ? (edition.imprint as any)?.name
                : edition.imprint;

              const publisherDisplay = edition.publisher?.name;

              return (
                <div key={edition.id} className="flex gap-6 pb-6 border-b border-gray-50 last:border-0 relative">
                  <Link to={PATHS.BOOK({ editionId: edition.id })} className="shrink-0">
                    <div className="w-[90px] rounded-sm bg-gray-50 border border-gray-100 shadow-sm transition-all hover:shadow-md">
                      {edition.coverUrl ? (
                        <img src={edition.coverUrl} alt={edition.title} className="w-full h-auto rounded-sm" />
                      ) : (
                        <div className="w-[90px] h-[135px] bg-gray-100 flex items-center justify-center text-gray-300" />
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <Link to={PATHS.BOOK({ editionId: edition.id })} className="text-[16px] font-bold text-gray-900 hover:text-emerald-700 block transition-colors tracking-tight">
                        {edition.title} ({formatName})
                      </Link>
                    </div>

                    <div className="text-[13px] text-gray-600 mt-1">
                      <p>Publicado em {edition.publicationDate ? formatPublicationDate(edition.publicationDate) : 'Data desconhecida'} por {publisherDisplay}</p>

                      <div className="flex flex-col">
                        <AnimatePresence>
                          {isExpanded ? (
                            <motion.div
                              key="details"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden space-y-0.5 py-1"
                            >
                              <div className="flex items-baseline py-0.5 -mt-1">
                                <span className="text-gray-600">
                                  {formatName}, {edition.formatCategoryId === 'audio' ? `${edition.duration || '---'} min` : `${edition.pages || '---'} páginas`}
                                </span>
                              </div>
                              <div className="flex items-baseline py-0.5 font-geist">
                                <span className="w-24 shrink-0 text-gray-400 font-medium text-[12px] tracking-wider">Autor(es):</span>
                                <span className="text-gray-900">{work?.primaryAuthors?.map(a => a.name).join(', ') || '---'}</span>
                              </div>
                              <div className="flex items-baseline py-0.5 font-geist">
                                <span className="w-24 shrink-0 text-gray-400 font-medium text-[12px] tracking-wider">Editora:</span>
                                <span className="text-gray-900">{edition.publisher?.name}{imprintName ? ` (${imprintName})` : ''}</span>
                              </div>
                              {!!edition.isbn13 && edition.formatCategoryId !== 'audio' && (
                                <div className="flex items-baseline py-0.5 font-geist">
                                  <span className="w-24 shrink-0 text-gray-400 font-medium text-[12px] tracking-wider">ISBN-13:</span>
                                  <span className="text-gray-900">{formatISBN(edition.isbn13)}</span>
                                </div>
                              )}
                              {!!edition.isbn10 && edition.formatCategoryId !== 'audio' && (
                                <div className="flex items-baseline py-0.5 font-geist">
                                  <span className="w-24 shrink-0 text-gray-400 font-medium text-[12px] tracking-wider">ISBN-10:</span>
                                  <span className="text-gray-900">{formatISBN(edition.isbn10)}</span>
                                </div>
                              )}
                              <div className="flex items-baseline py-0.5 font-geist">
                                <span className="w-24 shrink-0 text-gray-400 font-medium text-[12px] tracking-wider">ASIN:</span>
                                <span className="text-gray-900">{edition.asin || ''}</span>
                              </div>
                              <div className="flex items-baseline py-0.5 font-geist">
                                <span className="w-24 shrink-0 text-gray-400 font-medium text-[12px] tracking-wider">Idioma:</span>
                                <span className="text-gray-900">{getLanguageName(edition.language)}</span>
                              </div>
                              <div className="flex items-baseline py-0.5 font-geist">
                                <span className="w-24 shrink-0 text-gray-400 font-medium text-[12px] tracking-wider">Avaliação:</span>
                                <span className="text-gray-900">{edition.stats?.averageRating?.toFixed(2).replace('.', ',') || '0,00'} ({edition.stats?.ratingsCount || 0} {edition.stats?.ratingsCount === 1 ? 'avaliação' : 'avaliações'})</span>
                              </div>

                              <button
                                onClick={() => toggleExpand(edition.id)}
                                className="text-[12px] text-emerald-600 hover:underline mt-2 font-bold block"
                              >
                                menos detalhes
                              </button>
                            </motion.div>
                          ) : (
                            <button
                              onClick={() => toggleExpand(edition.id)}
                              className="text-[12px] text-emerald-600 hover:underline font-bold text-left"
                            >
                              mais detalhes
                            </button>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 w-[175px] flex flex-col items-center gap-2">
                    <ShelfButton
                      editionId={edition.id}
                      workId={work?.id || edition.workId}
                      size="sm"
                    />

                    <div className="flex flex-col items-center gap-1">
                      <StarRating
                        rating={edition.userRating || edition.stats?.averageRating || 0}
                        size="sm"
                        interactive={true}
                        onRate={(rating) => handleRate(edition.id, rating)}
                      />
                      <span className="text-[11px] text-gray-400 font-medium">Avaliar este livro</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-gray-500 text-sm">Nenhuma edição encontrada com os filtros selecionados.</p>
          </div>
        )}
      </main>
    </>
  );
}