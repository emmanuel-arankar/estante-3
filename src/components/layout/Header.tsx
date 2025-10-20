import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  MessageCircle,
  BookOpen,
  Menu,
  LogOut,
  Settings,
  UserCircle,
  Users
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
import { logout } from '@/services/auth';
import { subscribeToFriendRequests } from '@/services/firestore';
import { PATHS } from '@/router/paths';
import { User } from '@estante/common-types';

interface HeaderProps {
  userProfile: User | null;
  initialFriendRequests: number;
}

export const Header = ({ userProfile, initialFriendRequests }: HeaderProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [friendRequestsCount, setFriendRequestsCount] = useState(initialFriendRequests);

  const { isLoaded: isAvatarLoaded } = useImageLoad(userProfile?.photoURL);

  useEffect(() => {
    if (!userProfile?.id) { // # atualizado
      setFriendRequestsCount(0);
      return;
    };

    const unsubscribe = subscribeToFriendRequests(userProfile.id, (requests) => { // # atualizado
      setFriendRequestsCount(requests.length);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userProfile?.id]); // # atualizado

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate(PATHS.HOME);
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
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

          {userProfile ? ( // # atualizado
            <>
              <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-8">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="text" placeholder="Buscar livros, autores, editoras ou usuários..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2 w-full bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500 rounded-full font-sans" />
                </div>
              </form>

              <div className="hidden md:flex items-center space-x-4">
                {/* # atualizado: Removido o Button asChild e aplicado estilos no Link */}
                <Link
                  to={PATHS.NOTIFICATIONS}
                  className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'relative rounded-full' })}
                >
                  <Bell className="h-5 w-5" />
                </Link>

                {/* # atualizado: Removido o Button asChild e aplicado estilos no Link */}
                <Link
                  to={PATHS.MESSAGES}
                  className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'relative rounded-full' })}
                >
                  <MessageCircle className="h-5 w-5" />
                </Link>

                {/* # atualizado: Removido o Button asChild e aplicado estilos no Link */}
                <Link
                  to={PATHS.FRIENDS}
                  className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'relative rounded-full' })}
                >
                  <Users className="h-5 w-5" />
                  {friendRequestsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {friendRequestsCount > 99 ? '+99' : friendRequestsCount}
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
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Configurações</span>
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
          ) : (
            <div className="hidden md:flex items-center space-x-4">
              <Button 
                variant="ghost" 
                asChild 
                className="text-gray-600 hover:text-emerald-600 rounded-full font-sans mb-2"
              >
                <Link to={PATHS.LOGIN}>
                  Entrar
                </Link>
              </Button>
              <Button 
                asChild 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 font-sans"
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
                          <SheetClose asChild><Link to={PATHS.MESSAGES} className="flex items-center p-2 rounded-md hover:bg-gray-100"><MessageCircle className="mr-3 h-5 w-5" />Mensagens</Link></SheetClose>
                          <SheetClose asChild><Link to={PATHS.PROFILE_EDIT} className="flex items-center p-2 rounded-md hover:bg-gray-100"><Settings className="mr-3 h-5 w-5" />Configurações</Link></SheetClose>
                        </nav>
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
  );
};