import { useState, useEffect } from 'react';
import { useLoaderData, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Link as LinkIcon, Calendar, Edit3, Cake, UserPlus, MessageCircle, Camera, UserMinus, X, Check, MoreVertical, Ban } from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';
import { ProfilePhotoMenu } from '@/components/profile/ProfilePhotoMenu';
import { PhotoViewer } from '@/components/profile/PhotoViewer';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AvatarEditorModal } from '@/components/ui/avatar-editor-modal';
import { trackEvent } from '@/lib/analytics';
import { syncProfileAPI } from '@/services/friendshipsApi';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent
} from '@/components/ui/card';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import {
  Tabs,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  toastSuccessClickable,
  toastErrorClickable
} from '@/components/ui/toast';
import { useFriendshipStatus } from '@/hooks/useDenormalizedFriends';
import { SMOOTH_TRANSITION, tabContentVariants } from '@/lib/animations';
import { PATHS } from '@/router/paths';
import {
  sendFriendRequestAPI,
  getMutualFriendsAPI,
  acceptFriendRequestAPI,
  removeFriendshipAPI,
  blockUserAPI,
} from '@/services/friendshipsApi';
import { fetchMutualFriendsDeduped } from '@/hooks/useMutualFriendsCache';
import { useAuthStore } from '@/stores/authStore';
import { User as UserModel } from '@estante/common-types';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

// Função para converter datas do Firestore com segurança
const convertFirestoreDate = (date: any): Date | null => {
  if (!date) return null;
  if (typeof date === 'object' && date.seconds) {
    return new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
  }
  if (date instanceof Date) {
    return date;
  }
  const d = new Date(date);
  if (!isNaN(d.getTime())) {
    return d;
  }
  return null;
};

// Componente para exibir amigos em comum no perfil com avatar group
const MutualFriendsIndicator: React.FC<{ userId: string; friendId: string; count: number }> = ({ userId, friendId, count }) => {
  const [avatarFriends, setAvatarFriends] = useState<{ displayName: string; nickname: string; photoURL: string | null }[]>([]);
  const [allFriends, setAllFriends] = useState<{ displayName: string; nickname: string; photoURL: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [avatarsLoading, setAvatarsLoading] = useState(true);

  useEffect(() => {
    // Carregar os primeiros 3 avatares imediatamente usando função deduplicada
    const loadAvatars = async () => {
      try {
        const result = await fetchMutualFriendsDeduped(
          userId,
          friendId,
          () => getMutualFriendsAPI(friendId)
        );
        setAvatarFriends(result.friends.slice(0, 3));
      } catch (error) {
        console.error('Erro ao carregar avatares:', error);
      } finally {
        setAvatarsLoading(false);
      }
    };
    loadAvatars();
  }, [userId, friendId, count]);

  const loadAllFriends = async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      // Usar função deduplicada
      const result = await fetchMutualFriendsDeduped(
        userId,
        friendId,
        () => getMutualFriendsAPI(friendId)
      );
      setAllFriends(result.friends);
      setLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar amigos em comum:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayText = count === 1 ? 'amigo em comum' : 'amigos em comum';
  const remaining = count - 3;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className="flex items-center cursor-help hover:opacity-80 transition-opacity"
            onMouseEnter={loadAllFriends}
          >
            {/* Avatar Group - primeiros 3 avatares sobrepostos */}
            <div className="flex items-center -space-x-2 mr-2">
              {avatarsLoading ? (
                // Skeleton para avatares carregando
                <>
                  {[...Array(Math.min(count, 3))].map((_, index) => (
                    <div
                      key={index}
                      className="relative w-8 h-8 rounded-full bg-gray-200 animate-pulse ring-2 ring-white"
                      style={{ zIndex: 3 - index }}
                    />
                  ))}
                </>
              ) : (
                <>
                  {avatarFriends.map((friend, index) => (
                    <div key={index} className="relative" style={{ zIndex: 3 - index }}>
                      <OptimizedAvatar
                        src={friend.photoURL || undefined}
                        alt={friend.displayName}
                        fallback={friend.displayName}
                        size="sm"
                        className="ring-2 ring-white"
                      />
                    </div>
                  ))}
                  {/* Indicador +X se houver mais de 3 */}
                  {remaining > 0 && (
                    <div
                      className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 ring-2 ring-white text-xs font-semibold text-gray-700"
                      style={{ zIndex: 0 }}
                    >
                      +{remaining}
                    </div>
                  )}
                </>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {count} {displayText}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {loading ? (
            <p className="text-sm">Carregando...</p>
          ) : allFriends.length > 0 ? (
            <ul className="text-sm space-y-1">
              {allFriends.map((friend, index) => (
                <li key={index}>{friend.displayName}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">{count} {displayText}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// # atualizado: Componente interno para renderizar o perfil real
const ProfileContent = ({ initialProfileUser }: { initialProfileUser: UserModel }) => {
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: initialProfileUser.displayName,
    url: `https://URL_DO_SEU_SITE/profile/${initialProfileUser.nickname}`,
    image: initialProfileUser.photoURL,
    description: initialProfileUser.bio,
  };

  const [profileUser, setProfileUser] = useState<UserModel>(initialProfileUser);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentAvatarData, setCurrentAvatarData] = useState<{ uploadedAt?: Date; id?: string; }>({});
  const [mutualFriendsCount, setMutualFriendsCount] = useState<number | null>(null);
  const [blockDialog, setBlockDialog] = useState(false);

  const outletKey = location.pathname;

  const getCurrentTab = () => {
    const pathSegments = location.pathname.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    const tabs = ['activity', 'books', 'reviews', 'friends'];

    if (tabs.includes(lastSegment)) {
      return lastSegment;
    }
    return 'activity';
  };

  const { status: friendshipStatus, loading: friendshipLoading } = useFriendshipStatus(profileUser?.id || '');

  useEffect(() => {
    setProfileUser(initialProfileUser);
    setIsOwnProfile(currentUser?.uid === initialProfileUser?.id);
  }, [initialProfileUser, currentUser]);

  useEffect(() => {
    const fetchAvatarData = async () => {
      if (!profileUser?.id) return;
      try {
        const avatars = await apiClient<any[]>(`/users/${profileUser.id}/avatars`);
        const currentAvatar = avatars.find((avatar: any) => avatar.isCurrent);
        if (currentAvatar) {
          setCurrentAvatarData({
            uploadedAt: currentAvatar.uploadedAt,
            id: currentAvatar.id
          });
        }
      } catch (error) {
        console.error('Erro ao buscar dados do avatar:', error);
      }
    };
    fetchAvatarData();
  }, [profileUser?.id]);

  // Calcular amigos em comum quando não for o próprio perfil
  useEffect(() => {
    const loadMutualFriends = async () => {
      if (!currentUser || !profileUser || isOwnProfile) {
        setMutualFriendsCount(null);
        return;
      }

      try {
        // Usar função deduplicada para evitar chamadas paralelas duplicadas
        const result = await fetchMutualFriendsDeduped(
          currentUser.uid,
          profileUser.id,
          () => getMutualFriendsAPI(profileUser.id)
        );
        setMutualFriendsCount(result.count > 0 ? result.count : null);
      } catch (error) {
        console.error('Erro ao calcular amigos em comum:', error);
        setMutualFriendsCount(null);
      }
    };

    loadMutualFriends();
  }, [currentUser, profileUser, isOwnProfile]);

  const handleEditProfile = () => {
    navigate(PATHS.PROFILE_EDIT);
  };

  const handleSendFriendRequest = async () => {
    if (!currentUser || !profileUser) return;
    setActionLoading(true);
    try {
      await sendFriendRequestAPI(profileUser.id);
      trackEvent('friend_request_sent', { target_uid: profileUser.id });
      toastSuccessClickable('Solicitação de amizade enviada!');
      // Invalida cache para atualizar o botão
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendshipStatus', profileUser.id] });
    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
      toastErrorClickable('Erro ao enviar solicitação de amizade');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!currentUser || !profileUser) return;
    setActionLoading(true);
    try {
      await removeFriendshipAPI(`${currentUser.uid}_${profileUser.id}`);
      toastSuccessClickable('Solicitação cancelada');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendshipStatus', profileUser.id] });
    } catch (error) {
      console.error('Erro ao cancelar solicitação:', error);
      toastErrorClickable('Erro ao cancelar solicitação');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser || !profileUser) return;
    setActionLoading(true);
    try {
      await acceptFriendRequestAPI(`${currentUser.uid}_${profileUser.id}`);
      trackEvent('friend_request_accepted', { target_uid: profileUser.id });
      toastSuccessClickable('Solicitação aceita!');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendshipStatus', profileUser.id] });
    } catch (error) {
      console.error('Erro ao aceitar solicitação:', error);
      toastErrorClickable('Erro ao aceitar solicitação');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!currentUser || !profileUser) return;
    setActionLoading(true);
    try {
      await removeFriendshipAPI(`${currentUser.uid}_${profileUser.id}`);
      toastSuccessClickable('Solicitação recusada');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendshipStatus', profileUser.id] });
    } catch (error) {
      console.error('Erro ao recusar solicitação:', error);
      toastErrorClickable('Erro ao recusar solicitação');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!currentUser || !profileUser) return;
    setActionLoading(true);
    try {
      await removeFriendshipAPI(`${currentUser.uid}_${profileUser.id}`);
      toastSuccessClickable('Amizade desfeita');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendshipStatus', profileUser.id] });
    } catch (error) {
      console.error('Erro ao desfazer amizade:', error);
      toastErrorClickable('Erro ao desfazer amizade');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePhotoUpdate = async (newPhotoURL: string) => {
    console.log('🔵 handlePhotoUpdate called with:', newPhotoURL);

    setProfileUser(prev => ({ ...prev!, photoURL: newPhotoURL }));
    setShowPhotoEditor(false);

    if (isOwnProfile && currentUser) {
      console.log('🔵 Otimizando UI no Zustand Store Auth...');

      try {
        // 1. Atualização Otimista Imediata no Zustand (Reflete no Header na hora)
        const store = useAuthStore.getState();
        if (store.userProfile) {
          const freshProfile = { ...store.userProfile, photoURL: newPhotoURL };
          store.setUserProfile(freshProfile);

          // 2. Injeta o novo avatar no cache do React Query
          // Isso VETA o Router Loader (ensureQueryData) de ressuscitar a foto antiga
          queryClient.setQueryData(['users', currentUser.uid], freshProfile);
        }

        // 3. Invalida a chave CORRETA ('users' em vez de 'user') para fetching cego em background
        queryClient.invalidateQueries({ queryKey: ['users', currentUser.uid] });

        // 4. Sincronizar amizades para propagar a nova foto para os cards dos amigos (background)
        syncProfileAPI().catch(error => console.error('🔴 Erro ao sincronizar foto com amizades:', error));
      } catch (error) {
        console.error('🔴 Error updating profile cache:', error);
      }
    }
  };

  const handleBlockUser = async () => {
    console.log('handleBlockUser chamado', { currentUser, profileUser });

    if (!currentUser || !profileUser) {
      console.error('Usuário não autenticado ou perfil inválido');
      toastErrorClickable('Erro: usuário não autenticado');
      return;
    }

    setBlockDialog(false);

    setActionLoading(true);
    try {
      console.log('Chamando blockUserAPI para:', profileUser.id);
      await blockUserAPI(profileUser.id);
      toastSuccessClickable('Usuário bloqueado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['blockedUsers'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', profileUser.id] });
      // Opcional: Redirecionar para home ou atualizar UI para mostrar estado bloqueado
      navigate(PATHS.HOME);
    } catch (error) {
      console.error('Erro ao bloquear usuário:', error);
      toastErrorClickable(`Erro ao bloquear usuário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!profileUser) {
    // ... existing null profile check
    return (
      <div className="flex items-center justify-center text-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Usuário não encontrado</h2>
          <p className="text-gray-600 mb-4">O perfil que você está procurando não existe.</p>
          <Button onClick={() => navigate(PATHS.HOME)}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMetadata
        // ... existing metadata props
        title={`${initialProfileUser.displayName} (@${initialProfileUser.nickname})`}
        description={`Veja o perfil, os livros e as atividades de ${initialProfileUser.displayName} na Estante de Bolso.`}
        ogTitle={initialProfileUser.displayName}
        ogDescription={`Confira o perfil de ${initialProfileUser.displayName} (@${initialProfileUser.nickname}) e suas leituras.`}
        image={initialProfileUser.photoURL}
        schema={personSchema}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-start space-y-6 md:space-y-0 md:space-x-8">
              {/* ... existing avatar code ... */}
              <div className="relative">
                {isOwnProfile ? (
                  <ProfilePhotoMenu
                    currentPhotoURL={profileUser.photoURL}
                    onView={() => setShowPhotoViewer(true)}
                    onEdit={() => setShowPhotoEditor(true)}
                    trigger={
                      <div className="relative cursor-pointer group">
                        <OptimizedAvatar
                          src={profileUser.photoURL}
                          alt={profileUser.displayName}
                          fallback={profileUser.displayName}
                          size="xl"
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    }
                  />
                ) : (
                  <OptimizedAvatar
                    src={profileUser.photoURL}
                    alt={profileUser.displayName}
                    fallback={profileUser.displayName}
                    size="xl"
                  />
                )}
              </div>

              <div className="flex-1 w-full">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      {profileUser.displayName}
                    </h1>
                    <p className="text-gray-600 mb-2">@{profileUser.nickname}</p>
                    {!isOwnProfile && mutualFriendsCount && mutualFriendsCount > 0 && currentUser && (
                      <MutualFriendsIndicator
                        userId={currentUser.uid}
                        friendId={profileUser.id}
                        count={mutualFriendsCount}
                      />
                    )}
                  </div>

                  {isOwnProfile ? (
                    <Button
                      variant="outline"
                      className="rounded-full mt-4 md:mt-0"
                      onClick={handleEditProfile}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Editar Perfil
                    </Button>
                  ) : (
                    <div className="flex space-x-2 mt-4 md:mt-0">
                      {friendshipLoading ? (
                        <Button variant="outline" className="rounded-full" disabled>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Verificando...
                        </Button>
                      ) : (
                        <>
                          {/* Botão Principal Variável */}
                          {friendshipStatus === 'none' && (
                            <Button
                              className="rounded-full bg-emerald-600 hover:bg-emerald-700"
                              onClick={handleSendFriendRequest}
                              disabled={actionLoading}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Adicionar Amigo
                            </Button>
                          )}

                          {friendshipStatus === 'friends' && (
                            <Button
                              className="rounded-full bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => navigate(PATHS.CHAT({ receiverId: profileUser.id }))}
                            >
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Mensagem
                            </Button>
                          )}

                          {/* Menu de Ações (Sempre visível para não-dono) */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="rounded-full"
                                disabled={actionLoading}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">

                              {/* Ações Específicas de Status */}
                              {friendshipStatus === 'friends' && (
                                <DropdownMenuItem
                                  onClick={handleRemoveFriend}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Desfazer Amizade
                                </DropdownMenuItem>
                              )}

                              {friendshipStatus === 'request_sent' && (
                                <DropdownMenuItem onClick={handleCancelRequest}>
                                  <X className="h-4 w-4 mr-2" />
                                  Cancelar Solicitação
                                </DropdownMenuItem>
                              )}

                              {friendshipStatus === 'request_received' && (
                                <>
                                  <DropdownMenuItem onClick={handleAcceptRequest}>
                                    <Check className="h-4 w-4 mr-2" />
                                    Aceitar Solicitação
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={handleRejectRequest}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Recusar Solicitação
                                  </DropdownMenuItem>
                                </>
                              )}

                              {/* Separator apenas se houver itens acima */}
                              {friendshipStatus !== 'none' && <DropdownMenuSeparator />}

                              {/* Ações Globais */}
                              <DropdownMenuItem
                                onClick={() => setBlockDialog(true)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Bloquear Usuário
                              </DropdownMenuItem>

                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {profileUser.bio && (
                  <div
                    className="text-gray-700 mb-4 [&_p]:mb-1/2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
                    dangerouslySetInnerHTML={{ __html: profileUser.bio }}
                  />
                )}
                <div className="space-y-2 text-sm text-gray-600">
                  {profileUser.location && (
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-3 text-gray-400" />
                      <span>
                        {typeof profileUser.location === 'string'
                          ? profileUser.location
                          : `${profileUser.location.city}, ${profileUser.location.stateCode}`}
                      </span>
                    </div>
                  )}
                  {profileUser.website && (
                    <div className="flex items-center">
                      <LinkIcon className="h-4 w-4 mr-3 text-gray-400" />
                      <a href={profileUser.website} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                        {profileUser.website}
                      </a>
                    </div>
                  )}
                  {(() => {
                    const birthDate = convertFirestoreDate(profileUser.birthDate);
                    if (birthDate && !isNaN(birthDate.getTime())) {
                      return (
                        <div className="flex items-center">
                          <Cake className="h-4 w-4 mr-3 text-gray-400" />
                          <span>
                            Nasceu em {format(birthDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {(() => {
                    const joinedAt = convertFirestoreDate(profileUser.joinedAt);
                    if (joinedAt && !isNaN(joinedAt.getTime())) {
                      return (
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-3 text-gray-400" />
                          <span>
                            Membro {formatDistanceToNow(joinedAt, { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <Tabs
            value={getCurrentTab()}
            className="w-full"
            onValueChange={(tab) => navigate(tab, { replace: true })}
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="activity">Atividade</TabsTrigger>
              <TabsTrigger value="books">Livros</TabsTrigger>
              <TabsTrigger value="reviews">Resenhas</TabsTrigger>
              <TabsTrigger value="friends">Amigos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* # atualizado: Lógica de animação e renderização do Outlet simplificada */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={outletKey}
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={SMOOTH_TRANSITION}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>

        {showPhotoViewer && profileUser.photoURL && (
          <PhotoViewer
            imageUrl={profileUser.photoURL}
            onClose={() => setShowPhotoViewer(false)}
            userAvatar={profileUser.photoURL}
            userName={profileUser.displayName}
            userId={profileUser.id}
            avatarId={currentAvatarData.id}
            postDate={
              currentAvatarData.uploadedAt && !isNaN(new Date(currentAvatarData.uploadedAt).getTime())
                ? format(new Date(currentAvatarData.uploadedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                : "Data não disponível"
            }
          />
        )}

        {showPhotoEditor && (
          <AvatarEditorModal
            currentPhotoURL={profileUser.photoURL}
            onSave={handlePhotoUpdate}
            onCancel={() => setShowPhotoEditor(false)}
          />
        )}

        {/* Dialog de confirmação para bloquear */}
        <AlertDialog open={blockDialog} onOpenChange={setBlockDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bloquear usuário</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja bloquear {profileUser.displayName}? Vocês deixarão de ser amigos e ele não poderá ver seu perfil.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBlockUser}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {actionLoading ? 'Bloqueando...' : 'Bloquear'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </>
  );
};

// # atualizado: O loader agora retorna os dados diretamente (sem defer)
export const Profile = () => {
  const data = useLoaderData() as { profileUser: UserModel };

  if (!data?.profileUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <ProfileContent initialProfileUser={data.profileUser} />;
};
