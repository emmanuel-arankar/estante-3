import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, BookOpen, User, Layers, AlertCircle,
  Star, Calendar, Globe, ChevronLeft, ChevronRight,
  Plus, SlidersHorizontal, Users
} from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';
import { PATHS } from '@/router/paths';
import { Work, Person, Series } from '@estante/common-types';
import {
  searchWorksAPI,
  searchPersonsAPI,
  searchSeriesAPI,
} from '@/features/books/services/booksApi';
import { searchUsersAPI } from '@/services/api/api';

// ==== ==== TIPOS ==== ====

type TabId = 'all' | 'works' | 'persons' | 'users' | 'series';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'Tudo', icon: SlidersHorizontal },
  { id: 'works', label: 'Obras', icon: BookOpen },
  { id: 'persons', label: 'Autores', icon: User },
  { id: 'users', label: 'Leitores', icon: Users },
  { id: 'series', label: 'Séries', icon: Layers },
];

// ==== ==== SKELETONS ==== ====

const WorkCardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-4 animate-pulse">
    <div className="w-16 h-24 bg-gray-200 rounded-lg shrink-0" />
    <div className="flex-1 space-y-2 py-1">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
      <div className="h-3 bg-gray-100 rounded w-1/4 mt-4" />
    </div>
  </div>
);

const PersonCardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 animate-pulse">
    <div className="w-14 h-14 bg-gray-200 rounded-full shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
    </div>
  </div>
);

// ==== ==== CARDS ==== ====

const WorkCard = ({ work }: { work: Work }) => {
  const authors = ((work as any).primaryAuthors as any[]) ?? [];
  const year = (work as any).firstPublishedYear;

  return (
    <Link
      to={PATHS.WORK({ workId: work.id })}
      className="group bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.1)] hover:border-emerald-200 transition-all duration-300 p-4 flex gap-4 active:scale-[0.99]"
    >
      <div className="w-16 shrink-0">
        {(work as any).coverUrl ? (
          <img
            src={(work as any).coverUrl}
            alt={work.title}
            className="w-16 h-24 object-cover rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
          />
        ) : (
          <div className="w-16 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-emerald-400" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-gray-900 text-base leading-tight truncate group-hover:text-emerald-700 transition-colors">
          {work.title}
        </h3>
        {work.originalTitle && work.originalTitle !== work.title && (
          <p className="text-xs text-gray-400 mt-0.5 italic truncate">{work.originalTitle}</p>
        )}
        {authors.length > 0 && (
          <p className="text-sm text-gray-500 mt-1 truncate">
            {authors.map((a: any) => a.name).join(', ')}
          </p>
        )}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {year && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 font-medium">
              <Calendar className="w-3 h-3" />
              {year}
            </span>
          )}
          {(work as any).averageRating && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 font-bold">
              <Star className="w-3 h-3 fill-amber-400" />
              {Number((work as any).averageRating).toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 self-center">
        <ChevronRight className="w-5 h-5 text-emerald-500" />
      </div>
    </Link>
  );
};

const PersonCard = ({ person }: { person: Person }) => (
  <Link
    to={PATHS.AUTHOR({ personId: person.id })}
    className="group bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.1)] hover:border-emerald-200 transition-all duration-300 p-4 flex items-center gap-4 active:scale-[0.99]"
  >
    <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 ring-2 ring-gray-100 group-hover:ring-emerald-200 transition-all">
      {(person as any).photoUrl ? (
        <img src={(person as any).photoUrl} alt={person.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
          <User className="w-6 h-6 text-emerald-400" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-bold text-gray-900 text-base truncate group-hover:text-emerald-700 transition-colors">{person.name}</h3>
      {(person as any).nationality && (
        <span className="inline-flex items-center gap-1 text-xs text-gray-400 mt-0.5 font-medium">
          <Globe className="w-3 h-3" />
          {(person as any).nationality}
        </span>
      )}
      {(person as any).bio && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{(person as any).bio}</p>
      )}
    </div>
    <div className="opacity-0 group-hover:opacity-100 transition-all duration-300">
      <ChevronRight className="w-5 h-5 text-emerald-500" />
    </div>
  </Link>
);

const UserCard = ({ user }: { user: any }) => (
  <Link
    to={PATHS.PROFILE({ nickname: user.nickname || user.uid })}
    className="group bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.1)] hover:border-emerald-200 transition-all duration-300 p-4 flex items-center gap-4 active:scale-[0.99]"
  >
    <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 ring-2 ring-gray-100 group-hover:ring-emerald-200 transition-all">
      {user.photoURL || user.photoUrl ? (
        <img src={user.photoURL || user.photoUrl} alt={user.displayName || user.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
          <Users className="w-6 h-6 text-violet-400" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-bold text-gray-900 text-base truncate group-hover:text-emerald-700 transition-colors">
        {user.displayName || user.name || 'Leitor'}
      </h3>
      {user.nickname && (
        <p className="text-xs text-gray-400 mt-0.5 font-medium">@{user.nickname}</p>
      )}
      {user.bio && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{user.bio}</p>
      )}
    </div>
    <div className="opacity-0 group-hover:opacity-100 transition-all duration-300">
      <ChevronRight className="w-5 h-5 text-emerald-500" />
    </div>
  </Link>
);

const SeriesCard = ({ series }: { series: Series }) => (
  <Link
    to={PATHS.SERIES({ seriesId: series.id })}
    className="group bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.1)] hover:border-emerald-200 transition-all duration-300 p-4 flex items-center gap-4 active:scale-[0.99]"
  >
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center shrink-0 group-hover:from-violet-200 transition-all">
      <Layers className="w-5 h-5 text-violet-500" />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-bold text-gray-900 text-base truncate group-hover:text-emerald-700 transition-colors">{series.name}</h3>
      {(series as any).totalBooks && (
        <p className="text-xs text-gray-400 mt-0.5">{(series as any).totalBooks} volumes</p>
      )}
    </div>
    <div className="opacity-0 group-hover:opacity-100 transition-all duration-300">
      <ChevronRight className="w-5 h-5 text-emerald-500" />
    </div>
  </Link>
);

// ==== ==== PAGINAÇÃO ==== ====

const Pagination = ({ page, totalPages, onPrev, onNext }: {
  page: number; totalPages: number; onPrev: () => void; onNext: () => void;
}) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button onClick={onPrev} disabled={page === 1} className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-500 font-medium">{page} / {totalPages}</span>
      <button onClick={onNext} disabled={page === totalPages} className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

// Empty State
const EmptyState = ({ query }: { query: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center py-12">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <Search className="w-10 h-10 text-gray-300" />
      </div>
      <h2 className="text-xl font-bold text-gray-700 mb-2">
        Nenhum resultado para <span className="text-emerald-600">"{query}"</span>
      </h2>
      <p className="text-gray-400 text-sm mb-2 max-w-xs mx-auto">
        Tente verificar a ortografia ou usar termos mais simples. Você pode sugerir o cadastro de um novo livro!
      </p>
      <Link
        to={PATHS.HOME}
        className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
      >
        <Plus className="w-4 h-4" />
        Sugerir novo livro
      </Link>
    </motion.div>
  </div>
);

// Estado inicial (sem query digitada)
const InitialState = () => (
  <div className="flex-1 flex flex-col items-center justify-center py-12">
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center"
    >
      <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <BookOpen className="w-10 h-10 text-emerald-300" />
      </div>
      <p className="text-gray-400 text-base">Digite pelo menos 2 caracteres para buscar</p>
      <p className="text-gray-300 text-sm mt-2">Obras, autores, leitores, séries...</p>
    </motion.div>
  </div>
);

// ==== ==== SECÃO DE RESULTADOS ==== ====

interface ResultSectionProps {
  title: string; count?: number; icon: React.ElementType;
  children: React.ReactNode; isLoading: boolean; skeletonCount?: number;
  SkeletonComponent: React.FC;
  page: number; totalPages: number; onPrev: () => void; onNext: () => void;
}

const ResultSection = ({ title, count, icon: Icon, children, isLoading, skeletonCount = 4, SkeletonComponent, page, totalPages, onPrev, onNext }: ResultSectionProps) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-emerald-600" />
      <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className="ml-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
    {isLoading ? (
      <div className="space-y-3">{Array.from({ length: skeletonCount }).map((_, i) => <SkeletonComponent key={i} />)}</div>
    ) : (
      <>
        <div className="space-y-3">{children}</div>
        <Pagination page={page} totalPages={totalPages} onPrev={onPrev} onNext={onNext} />
      </>
    )}
  </div>
);

// ==== ==== PÁGINA PRINCIPAL ==== ====

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') ?? '';
  const [inputValue, setInputValue] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [worksPage, setWorksPage] = useState(1);
  const [personsPage, setPersonsPage] = useState(1);

  useEffect(() => {
    setInputValue(q);
    setWorksPage(1);
    setPersonsPage(1);
  }, [q]);

  const enabled = q.trim().length >= 2;

  const worksQuery = useQuery({
    queryKey: ['search', 'works', q, worksPage],
    queryFn: () => searchWorksAPI(q, worksPage, 8),
    enabled,
    staleTime: 30_000,
  });

  const personsQuery = useQuery({
    queryKey: ['search', 'persons', q, personsPage],
    queryFn: () => searchPersonsAPI(q, personsPage, 8),
    enabled,
    staleTime: 30_000,
  });

  const usersQuery = useQuery({
    queryKey: ['search', 'users', q],
    queryFn: () => searchUsersAPI(q),
    enabled,
    staleTime: 30_000,
  });

  const seriesQuery = useQuery({
    queryKey: ['search', 'series', q],
    queryFn: () => searchSeriesAPI(q),
    enabled,
    staleTime: 30_000,
  });

  const works = worksQuery.data?.data ?? [];
  const persons: Person[] = Array.isArray(personsQuery.data) ? personsQuery.data : ((personsQuery.data as any)?.data ?? []);
  const users: any[] = usersQuery.data ?? [];
  const seriesResults: Series[] = Array.isArray(seriesQuery.data) ? seriesQuery.data : [];

  const worksTotalPages = worksQuery.data?.pagination?.totalPages ?? 1;
  const personsTotalPages = !Array.isArray(personsQuery.data) ? ((personsQuery.data as any)?.pagination?.totalPages ?? 1) : 1;

  const worksTotal = worksQuery.data?.pagination?.total ?? 0;
  const totalResults = worksTotal + persons.length + users.length + seriesResults.length;

  const isAnyLoading = worksQuery.isFetching || personsQuery.isFetching || usersQuery.isFetching || seriesQuery.isFetching;
  const hasAnyResults = works.length > 0 || persons.length > 0 || users.length > 0 || seriesResults.length > 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) setSearchParams({ q: inputValue.trim() });
  };

  const showWorks = activeTab === 'all' || activeTab === 'works';
  const showPersons = activeTab === 'all' || activeTab === 'persons';
  const showUsers = activeTab === 'all' || activeTab === 'users';
  const showSeries = activeTab === 'all' || activeTab === 'series';

  return (
    <>
      <PageMetadata
        title={q ? `Resultados para "${q}" | Estante de Bolso` : 'Busca | Estante de Bolso'}
        description="Busque por livros, autores, leitores e séries na Estante de Bolso."
      />

      <div className="flex flex-col bg-gray-50" style={{ minHeight: 'calc(100vh - 80px)' }}>
        {/* Hero de Busca */}
        <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 pt-6 pb-6 px-4">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-4 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>

            <form onSubmit={handleSearch}>
              <label className="block text-white/80 text-sm font-semibold mb-2 uppercase tracking-wider">
                O que você busca?
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="search"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="Título, autor, leitor, ISBN, série..."
                  autoFocus
                  className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl text-gray-900 text-base outline-none shadow-lg focus:ring-2 focus:ring-yellow-300 placeholder:text-gray-400"
                />
              </div>
            </form>

            {enabled && !isAnyLoading && q && (
              <p className="text-white/70 text-sm mt-4">
                {hasAnyResults ? (
                  <>Encontrados <span className="text-white font-bold">{totalResults}+</span> resultados para "<span className="text-yellow-200 font-semibold">{q}</span>"</>
                ) : (
                  <>Sem resultados para "<span className="text-yellow-200 font-semibold">{q}</span>"</>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col max-w-3xl mx-auto px-4 pb-20 w-full">
          {/* Abas */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-4 -mx-4 px-4">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border shrink-0 transition-all duration-200 ${activeTab === tab.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Estado inicial */}
          {!enabled && <InitialState />}

          {/* Estado vazio */}
          {enabled && !isAnyLoading && !hasAnyResults && q && <EmptyState query={q} />}

          {/* Resultados */}
          <AnimatePresence mode="wait">
            {enabled && (isAnyLoading || hasAnyResults) && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-10"
              >
                {/* Obras */}
                {showWorks && (works.length > 0 || worksQuery.isFetching) && (
                  <ResultSection
                    title="Obras" count={worksQuery.data?.pagination?.total} icon={BookOpen}
                    isLoading={worksQuery.isFetching} SkeletonComponent={WorkCardSkeleton} skeletonCount={4}
                    page={worksPage} totalPages={worksTotalPages}
                    onPrev={() => setWorksPage(p => Math.max(1, p - 1))}
                    onNext={() => setWorksPage(p => Math.min(worksTotalPages, p + 1))}
                  >
                    {works.map(work => <WorkCard key={work.id} work={work} />)}
                  </ResultSection>
                )}

                {/* Autores */}
                {showPersons && (persons.length > 0 || personsQuery.isFetching) && (
                  <ResultSection
                    title="Autores & Pessoas" count={persons.length} icon={User}
                    isLoading={personsQuery.isFetching} SkeletonComponent={PersonCardSkeleton} skeletonCount={3}
                    page={personsPage} totalPages={personsTotalPages}
                    onPrev={() => setPersonsPage(p => Math.max(1, p - 1))}
                    onNext={() => setPersonsPage(p => Math.min(personsTotalPages, p + 1))}
                  >
                    {persons.map((person: Person) => <PersonCard key={person.id} person={person} />)}
                  </ResultSection>
                )}

                {/* Leitores (Usuários) */}
                {showUsers && (users.length > 0 || usersQuery.isFetching) && (
                  <ResultSection
                    title="Leitores" count={users.length} icon={Users}
                    isLoading={usersQuery.isFetching} SkeletonComponent={PersonCardSkeleton} skeletonCount={3}
                    page={1} totalPages={1} onPrev={() => { }} onNext={() => { }}
                  >
                    {users.map((user: any) => <UserCard key={user.uid || user.id} user={user} />)}
                  </ResultSection>
                )}

                {/* Séries */}
                {showSeries && (seriesResults.length > 0 || seriesQuery.isFetching) && (
                  <ResultSection
                    title="Séries" count={seriesResults.length} icon={Layers}
                    isLoading={seriesQuery.isFetching} SkeletonComponent={PersonCardSkeleton} skeletonCount={2}
                    page={1} totalPages={1} onPrev={() => { }} onNext={() => { }}
                  >
                    {seriesResults.map((s: Series) => <SeriesCard key={s.id} series={s} />)}
                  </ResultSection>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
