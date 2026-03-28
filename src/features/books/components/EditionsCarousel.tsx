import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getWorkEditionsFilteredAPI } from '@/features/books/services/booksApi';
import { Edition } from '@estante/common-types';
import { PATHS } from '@/router/paths';
import { getFormatById } from '@/data/book-formats';
import { getLanguageFlag } from '@/data/book-languages';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface EditionsCarouselProps {
  workId: string;
  currentEditionId: string;
}

export function EditionsCarousel({ workId, currentEditionId }: EditionsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['editions-carousel', workId],
    queryFn: () => getWorkEditionsFilteredAPI(workId, { limit: 13, page: 1 }),
    enabled: !!workId,
    staleTime: 1000 * 60 * 5,
  });

  const allEditions = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const editions = allEditions.filter(e => e.id !== currentEditionId);

  const [currentPage, setCurrentPage] = useState(0);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);

      // Cálculo de página robusto baseado no progresso total (0 a 1)
      const totalScrollable = scrollWidth - clientWidth;
      if (totalScrollable > 0) {
        const progress = scrollLeft / totalScrollable;
        const page = Math.round(progress * (totalPages - 1));
        if (page !== currentPage) {
          setCurrentPage(page);
        }
      } else {
        setCurrentPage(0);
      }
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [editions]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const scrollAmount = container.clientWidth;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (isLoading || editions.length === 0) return null;

  // Calcular número de indicadores (páginas)
  const itemsPerPage = 3;
  const totalPages = Math.ceil(editions.length / itemsPerPage);

  return (
    <div className="mt-10 pt-10 border-t-2 border-gray-100">
      {/* Título e Indicadores de Paginação */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">
          Mais edições
        </h3>

        {/* Indicadores estilo (Dashes) */}
        {totalPages > 1 && (
          <div className="flex gap-1.5 items-center mr-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <div
                key={i}
                className={`h-[3px] w-6 rounded-full transition-all duration-300 ${i === currentPage ? 'bg-gray-800' : 'bg-gray-200'
                  }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contêiner de Posicionamento Centralizado */}
      <div className="relative max-w-[580px] mx-auto group/carousel">
        {/* Botões de Navegação (Arrows) - Fora do recorte para visibilidade total */}
        {canScrollLeft && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute -left-8 top-[124px] -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-full shadow-lg text-gray-800 hover:bg-gray-50 hover:text-indigo-600 transition-all duration-300"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute -right-8 top-[124px] -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-full shadow-lg text-gray-800 hover:bg-gray-50 hover:text-indigo-600 transition-all duration-300"
            aria-label="Próximo"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Janela de Recorte Rigorosa: Apenas 3 itens perfeitos (527px + respiro) */}
        <div className="overflow-hidden px-4">
          <div className="max-w-[527px] mx-auto">
            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex gap-4 overflow-x-auto pb-6 no-scrollbar scroll-smooth snap-x"
              style={{
                maskImage: 'linear-gradient(to right, black 98%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, black 98%, transparent 100%)'
              }}
            >
              {editions.map((edition: Edition) => {
                const format = edition.formatId ? getFormatById(edition.formatId) : null;
                const year = edition.publicationDate?.match(/\d{4}/)?.[0];
                const flag = edition.language ? getLanguageFlag(edition.language) : null;

                return (
                  <Link
                    key={edition.id}
                    to={PATHS.BOOK({ editionId: edition.id })}
                    className="flex-none flex flex-col items-start gap-3 snap-start w-[165px] group/item"
                    title={edition.title}
                  >
                    {/* Zona de Capa Ampla com Alinhamento na Base (para evitar cortes) */}
                    <div className="w-[165px] h-[270px] flex flex-col justify-end">
                      <div className="w-[165px] rounded-[2px] bg-gray-50 border border-gray-100 shadow-sm transition-all duration-300 group-hover/item:shadow-xl group-hover/item:-translate-y-1 group-hover/item:scale-[1.02]">
                        {edition.coverUrl ? (
                          <img
                            src={edition.coverUrl}
                            alt={edition.title}
                            className="w-full h-auto rounded-[2px]"
                          />
                        ) : (
                          <div className="w-full aspect-[2/3] bg-gray-50" />
                        )}
                      </div>
                    </div>

                    {/* Metadados Refinados */}
                    <div className="flex flex-col text-left transition-colors group-hover/item:text-indigo-900">
                      <div className="h-[20px] mb-0.5">
                        <span className="text-sm font-semibold text-gray-900 line-clamp-1">
                          {format?.name || 'Edição'}
                        </span>
                      </div>
                      <div className="h-[18px]">
                        <span className="text-[13px] text-gray-500 line-clamp-1">
                          {edition.publisher?.name || 'Editora desconhecida'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] text-gray-400 font-medium h-[16px] mt-1">
                        <span>{year || 'n/d'}</span>
                        {edition.language && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-200" />
                            <span className="uppercase">{edition.language}</span>
                            {flag && <span className="opacity-80">{flag}</span>}
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-start mt-2">
        <Link
          to={`${PATHS.WORK_EDITIONS({ workId })}?from=${currentEditionId}`}
          className="flex items-center gap-1 text-[13px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors py-2 px-1"
        >
          Ver todas as {total} edições <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
