import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  MessageCircle,
  BookOpen,
  BookPlus,
  Menu,
  LogOut,
  Settings,
  UserCircle,
  Users,
  Ban,
  ShieldCheck,
  PenLine
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { trackEvent } from '@/lib/analytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useImageLoad } from '@/hooks/useImageLoad';
import { logout } from '@/services/firebase/auth';
import { subscribeToTotalUnreadMessages } from '@/services/firebase/realtime';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { PATHS } from '@/router/paths';
import { User } from '@estante/common-types';
import { searchUsersAPI } from '@/services/api/api';
import { searchWorksAPI } from '@/services/api/booksApi';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { useQuery } from '@tanstack/react-query';
import { getUserStatsAPI } from '@/services/api/friendshipsApi';
import { SuggestionModal } from '@/features/books/components/SuggestionModal';

interface HeaderProps {
  userProfile: User | null;
  initialFriendRequests: number;
  isAuthenticated?: boolean;
  isAuthLoading?: boolean;
}

export const Header = ({ userProfile, initialFriendRequests, isAuthenticated = false, isAuthLoading = false }: HeaderProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchWorks, setSearchWorks] = useState<any[]>([]);
  const [searchUsers, setSearchUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionIsbn, setSuggestionIsbn] = useState('');

  const { isLoaded: isAvatarLoaded } = useImageLoad(userProfile?.photoURL);

  // Estado de segurança local: Se o loading demorar > 3s, assume deslogado visualmente
  const [forceGuestMode, setForceGuestMode] = useState(false);

  useEffect(() => {
    if (isAuthLoading && !isAuthenticated && !userProfile) {
      const timer = setTimeout(() => {
        console.warn("Header loading timeout - showing guest UI");
        setForceGuestMode(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (!isAuthLoading) {
      setForceGuestMode(false);
    }
  }, [isAuthLoading, isAuthenticated, userProfile]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const fetchResults = async () => {
      if (debouncedSearch.length < 2) {
        setSearchWorks([]);
        setSearchUsers([]);
        return;
      }
      setIsSearching(true);
      try {
        const [worksRes, usersRes] = await Promise.all([
          searchWorksAPI(debouncedSearch, 1, 3).catch(() => ({ data: [] })),
          searchUsersAPI(debouncedSearch).catch(() => [])
        ]);

        trackEvent('search_performed', { search_term: debouncedSearch });

        setSearchWorks(worksRes.data || []);

        let usersArray = [];
        if (Array.isArray(usersRes)) {
          usersArray = usersRes;
        } else if (usersRes && typeof usersRes === 'object') {
          usersArray = (usersRes as any).data || (usersRes as any).users || Object.values(usersRes) || [];
          if (!Array.isArray(usersArray)) usersArray = [];
        }

        setSearchUsers(usersArray.slice(0, 2));
      } catch (e) {
        console.error(e);
        setSearchWorks([]);
        setSearchUsers([]);
      } finally {
        setIsSearching(false);
      }
    };
    fetchResults();
  }, [debouncedSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Apenas mostra loading se NÃO estivermos em modo de segurança
  const effectiveIsAuthLoading = isAuthLoading && !forceGuestMode;

  // Buscando os stats de usuários reativamente via React Query para manter a UI (Optimistic UI) 100% sincronizada com a página de amigos
  const { data: userStats } = useQuery({
    queryKey: ['userStats', userProfile?.id],
    queryFn: getUserStatsAPI,
    enabled: !!userProfile?.id,
    staleTime: 1000 * 60, // 1 minuto
  });

  const friendRequestsCount = userStats?.pendingRequests ?? (userProfile as any)?.pendingRequestsCount ?? initialFriendRequests;

  useEffect(() => {
    if (!userProfile?.id) {
      setUnreadMessagesCount(0);
      return;
    }

    // Reseta contador ao trocar de usuário antes de se inscrever
    setUnreadMessagesCount(0);

    const unsubscribe = subscribeToTotalUnreadMessages(userProfile.id, (count) => {
      setUnreadMessagesCount(count);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userProfile?.id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Navegar para Home PRIMEIRO para evitar que o ProtectedRoute da página atual
      // redirecione para /login quando o usuário ficar null.
      navigate(PATHS.HOME);
      await logout();
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Link to={PATHS.HOME} className="flex items-center space-x-3">
              <div className="bg-emerald-600 p-2.5 rounded-xl shadow-lg">
                <BookOpen className="h-7 w-7 text-white" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-xl font-bold text-emerald-700 font-sans">Estante de Bolso</span>
                <p className="text-xs text-gray-500 hidden sm:block font-sans">Toda literatura na palma da sua mão</p>
              </div>
            </Link>

            {userProfile ? (
              <>
                <div ref={searchRef} className="hidden md:flex flex-1 max-w-md mx-8 relative">
                  <form onSubmit={handleSearch} className="w-full">
                    <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Buscar livros, autores, editoras ou usuários..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        className="pl-10 pr-4 py-2 w-full bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500 rounded-full font-sans transition-all duration-200"
                      />
                    </div>
                  </form>

                  {/* Search Dropdown Preview */}
                  <AnimatePresence>
                    {isSearchFocused && searchQuery.length >= 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50"
                      >
                        {isSearching ? (
                          <div className="p-2 space-y-1">
                            {[...Array(3)].map((_, i) => (
                              <div key={i} className="flex items-center space-x-3 p-3">
                                <div className="h-10 w-10 rounded-full animate-shimmer" />
                                <div className="flex-1 space-y-2">
                                  <div className="h-4 w-1/3 rounded animate-shimmer" />
                                  <div className="h-3 w-1/4 rounded animate-shimmer" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (searchWorks.length > 0 || searchUsers.length > 0) ? (
                          <div className="p-2 flex flex-col">

                            {/* SESSÃO DE LIVROS */}
                            {searchWorks.length > 0 && (
                              <>
                                <span className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">Livros</span>
                                {searchWorks.map((work) => (
                                  <Link
                                    key={work.id}
                                    to={PATHS.WORK({ workId: work.id })}
                                    onClick={() => { setIsSearchFocused(false); setSearchQuery(''); }}
                                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-emerald-50 transition-colors"
                                  >
                                    <div className="w-10 h-14 bg-gray-50 rounded shadow-sm overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                                      {work.coverUrl || work.fallbackCoverUrl ? (
                                        <img src={work.coverUrl || work.fallbackCoverUrl} alt={work.title} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="flex flex-col items-center justify-center">
                                          <span className="text-emerald-700 font-sans font-bold text-base leading-none">
                                            {work.title.charAt(0).toUpperCase()}
                                          </span>
                                          <div className="absolute inset-0 bg-emerald-500/5" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-900 truncate">{work.title}</p>
                                      {work.subtitle && (
                                        <p className="text-xs text-gray-600 truncate italic">{work.subtitle}</p>
                                      )}
                                      <p className="text-xs text-gray-500 truncate">{work.primaryAuthors?.map((a: any) => a.name).join(', ')}</p>
                                    </div>
                                  </Link>
                                ))}
                              </>
                            )}

                            {/* SESSÃO DE USUÁRIOS */}
                            {searchUsers.length > 0 && (
                              <>
                                <span className="text-xs font-semibold text-gray-500 uppercase px-3 py-2 mt-2 border-t border-gray-50">Usuários</span>
                                {searchUsers.map((user) => (
                                  <Link
                                    key={user.id}
                                    to={PATHS.PROFILE({ nickname: user.nickname })}
                                    onClick={() => { setIsSearchFocused(false); setSearchQuery(''); }}
                                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-emerald-50 transition-colors"
                                  >
                                    <OptimizedAvatar src={user.photoURL} alt={user.displayName} fallback={user.displayName} size="sm" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName}</p>
                                      <p className="text-xs text-gray-500 truncate">@{user.nickname}</p>
                                    </div>
                                  </Link>
                                ))}
                              </>
                            )}

                            <button
                              onClick={handleSearch}
                              className="text-sm text-center text-emerald-600 font-semibold p-3 mt-1 hover:bg-emerald-50 rounded-lg transition-colors border-t border-gray-100"
                            >
                              Ver todos os resultados
                            </button>
                          </div>
                        ) : (
                          <div className="p-4 text-center">
                            <p className="text-sm text-gray-500 mb-3">Nenhum resultado para <strong>&ldquo;{searchQuery}&rdquo;</strong></p>
                            {isAuthenticated && (
                              <button
                                onClick={() => {
                                  const cleanQ = searchQuery.replace(/[-\s]/g, '').toUpperCase();
                                  const isPossibleIsbn = /^\d{10}$|^\d{13}$/.test(cleanQ);
                                  setSuggestionIsbn(isPossibleIsbn ? cleanQ : '');
                                  setShowSuggestionModal(true);
                                  setIsSearchFocused(false);
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold transition-colors border border-emerald-200"
                              >
                                <BookPlus className="w-4 h-4" />
                                Sugerir este livro
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>


                <div className="hidden md:flex items-center space-x-4">
                  <NotificationDropdown />

                  <Link
                    to={PATHS.MESSAGES}
                    className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'relative rounded-full' })}
                  >
                    <MessageCircle className="h-5 w-5" />
                    {unreadMessagesCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-[10px] font-bold items-center justify-center">
                          {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                        </span>
                      </span>
                    )}
                  </Link>

                  {/* # atualizado: Removido o Button asChild e aplicado estilos no Link */}
                  <Link
                    to={PATHS.FRIENDS}
                    className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'relative rounded-full' })}
                  >
                    <Users className="h-5 w-5" />
                    {friendRequestsCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-[10px] font-bold items-center justify-center">
                          {friendRequestsCount > 99 ? '99+' : friendRequestsCount}
                        </span>
                      </span>
                    )}
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        {isAvatarLoaded ? (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={userProfile?.photoURL} alt={userProfile?.displayName} />
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 font-sans">
                              {userProfile?.displayName?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <LoadingSpinner size="sm" />
                          </div>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <div className="flex items-center space-x-2 p-2">
                        <Avatar className="h-8 w-8"><AvatarImage src={userProfile?.photoURL} alt={userProfile?.displayName} /><AvatarFallback className="bg-emerald-100 text-emerald-700 font-sans">{userProfile?.displayName?.charAt(0) || 'U'}</AvatarFallback></Avatar>
                        <div className="flex flex-col space-y-1"><p className="text-sm font-medium leading-none">{userProfile?.displayName}</p><p className="text-xs leading-none text-muted-foreground">@{userProfile?.nickname}</p></div>
                      </div>
                      <DropdownMenuSeparator />
                      {/* # atualizado: Removido <PrefetchLink> e usado onSelect */}
                      <DropdownMenuItem
                        onSelect={() => navigate(PATHS.PROFILE_ME)}
                        className="cursor-pointer"
                      >
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>Meu Perfil</span>
                      </DropdownMenuItem>

                      {/* # atualizado: Removido <Link> e usado onSelect */}
                      <DropdownMenuItem
                        onSelect={() => navigate(PATHS.PROFILE_EDIT)}
                        className="cursor-pointer"
                      >
                        <PenLine className="mr-2 h-4 w-4" />
                        <span>Editar Perfil</span>
                      </DropdownMenuItem>

                      {userProfile?.role && ['admin', 'librarian', 'manager'].includes(userProfile.role) && (
                        <DropdownMenuItem
                          onSelect={() => navigate(PATHS.CURATOR_DASHBOARD)}
                          className="cursor-pointer text-emerald-700 focus:text-emerald-700 bg-emerald-50/50"
                        >
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          <span>Painel Bibliotecário</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={() => navigate(PATHS.SETTINGS_BLOCKED)}
                        className="cursor-pointer"
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        <span>Usuários Bloqueados</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="cursor-pointer text-red-600 focus:text-red-600"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>
                          {isLoggingOut ? 'Saindo...' : 'Sair'}
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            ) : (isAuthenticated || effectiveIsAuthLoading) ? (
              // Autenticado ou carregando auth - mostra loading simples
              <div className="hidden md:flex items-center space-x-4">
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center animate-pulse">
                  <LoadingSpinner size="sm" />
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-4">
                <Button
                  variant={location.pathname === PATHS.LOGIN ? 'outline' : 'ghost'}
                  asChild
                  className={`${location.pathname === PATHS.LOGIN ? 'border-emerald-600 text-emerald-600' : 'text-gray-600 hover:text-emerald-600'} rounded-full font-sans`}
                >
                  <Link to={PATHS.LOGIN}>
                    Entrar
                  </Link>
                </Button>
                <Button
                  variant={location.pathname === PATHS.REGISTER ? 'outline' : 'default'}
                  asChild
                  className={`${location.pathname === PATHS.REGISTER ? 'border-emerald-600 text-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} rounded-full px-6 font-sans`}
                >
                  <Link to={PATHS.REGISTER}>
                    Cadastrar
                  </Link>
                </Button>
              </div>
            )}

            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full max-w-xs p-0">
                  {/* # atualizado: Adicionado header para acessibilidade (corrige erro do console) */}
                  <SheetHeader className="sr-only">
                    <SheetTitle>Menu Principal</SheetTitle>
                    <SheetDescription>
                      Navegue pelas principais seções do site, acesse seu perfil
                      ou faça login.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex flex-col h-full">
                    {/* Cabeçalho do menu mobile */}
                    <div className="p-6 border-b">
                      <Link to={PATHS.HOME} className="flex items-center space-x-3">
                        <div className="bg-emerald-600 p-2 rounded-xl shadow-lg">
                          <BookOpen className="h-7 w-7 text-white" />
                        </div>
                        <div>
                          <span className="text-xl font-bold text-emerald-700 font-sans">
                            Estante de Bolso
                          </span>
                        </div>
                      </Link>
                    </div>

                    {/* Conteúdo do menu mobile */}
                    <div className="flex-1 overflow-y-auto p-6">
                      {userProfile ? (
                        <div className="space-y-4">
                          <SheetClose asChild>
                            <Link to={PATHS.PROFILE_ME} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={userProfile?.photoURL} alt={userProfile?.displayName} />
                                <AvatarFallback>{userProfile?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold">{userProfile.displayName}</p>
                                <p className="text-sm text-gray-500">@{userProfile.nickname}</p>
                              </div>
                            </Link>
                          </SheetClose>
                          <Separator />
                          <nav className="flex flex-col space-y-2">
                            <SheetClose asChild><Link to={PATHS.FRIENDS} className="flex items-center p-2 rounded-md hover:bg-gray-100"><Users className="mr-3 h-5 w-5" />Amigos</Link></SheetClose>
                            <SheetClose asChild><Link to={PATHS.NOTIFICATIONS} className="flex items-center p-2 rounded-md hover:bg-gray-100"><Bell className="mr-3 h-5 w-5" />Notificações</Link></SheetClose>
                            <SheetClose asChild>
                              <Link to={PATHS.MESSAGES} className="flex items-center p-2 rounded-md hover:bg-gray-100 flex-grow">
                                <div className="relative">
                                  <MessageCircle className="mr-3 h-5 w-5" />
                                  {unreadMessagesCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-white">
                                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                                    </span>
                                  )}
                                </div>
                                Mensagens
                              </Link>
                            </SheetClose>
                            <SheetClose asChild><Link to={PATHS.PROFILE_EDIT} className="flex items-center p-2 rounded-md hover:bg-gray-100"><PenLine className="mr-3 h-5 w-5" />Editar Perfil</Link></SheetClose>

                            {userProfile?.role && ['admin', 'librarian', 'manager'].includes(userProfile.role) && (
                              <SheetClose asChild>
                                <Link to={PATHS.CURATOR_DASHBOARD} className="flex items-center p-2 rounded-md hover:bg-emerald-50 text-emerald-700 font-medium">
                                  <ShieldCheck className="mr-3 h-5 w-5" />
                                  Painel Bibliotecário
                                </Link>
                              </SheetClose>
                            )}
                          </nav>
                        </div>
                      ) : (isAuthenticated || isAuthLoading) ? (
                        // Autenticado ou carregando auth - mostra loading simples
                        <div className="flex flex-col items-center justify-center py-8">
                          <LoadingSpinner size="md" className="text-emerald-600" />
                          <p className="mt-2 text-sm text-gray-500">
                            {isAuthLoading ? 'Verificando acesso...' : 'Carregando perfil...'}
                          </p>
                        </div>
                      ) : (
                        /* # atualizado: Adicionada separação entre os botões */
                        <div className="flex flex-col space-y-3">
                          <SheetClose asChild>
                            <Link to={PATHS.LOGIN}>
                              <Button
                                variant="outline"
                                className="w-full rounded-full"
                              >
                                Entrar
                              </Button>
                            </Link>
                          </SheetClose>
                          <div className="flex items-center py-2">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="mx-3 text-xs font-semibold text-gray-400">
                              OU
                            </span>
                            <div className="flex-grow border-t border-gray-200"></div>
                          </div>
                          <SheetClose asChild>
                            <Link to={PATHS.REGISTER}>
                              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-full">
                                Cadastrar
                              </Button>
                            </Link>
                          </SheetClose>
                        </div>
                      )}
                    </div>

                    {/* Rodapé do menu mobile */}
                    {userProfile && (
                      <div className="p-6 border-t">
                        <Button variant="ghost" onClick={handleLogout} disabled={isLoggingOut} className="w-full justify-start p-2 text-red-600 hover:bg-red-50 hover:text-red-600">
                          <LogOut className="mr-3 h-5 w-5" />
                          {isLoggingOut ? 'Saindo...' : 'Sair'}
                        </Button>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <SuggestionModal
        open={showSuggestionModal}
        onClose={() => setShowSuggestionModal(false)}
        initialIsbn={suggestionIsbn}
      />
    </>
  );
};