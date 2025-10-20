import { useState, useEffect, Suspense } from 'react';
import { useLoaderData, useNavigate, Outlet, useLocation, Await } from 'react-router-dom';
import {
  MapPin,
  Link as LinkIcon,
  Calendar,
  Edit3,
  Cake,
  UserPlus,
  UserCheck,
  MessageCircle,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import { ProfilePhotoMenu } from '@/components/profile/ProfilePhotoMenu';
import { PhotoViewer } from '@/components/profile/PhotoViewer';
import { AvatarEditorModal } from '@/components/ui/avatar-editor-modal';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { ProfileSkeleton } from '@/components/profile/ProfileSkeleton'; 
import { useAuthStore } from '@/stores/authStore';
import { useFriendshipStatus } from '@/hooks/useDenormalizedFriends';
import { User as UserModel } from '../models';
import { sendDenormalizedFriendRequest } from '@/services/denormalizedFriendships';
import { getUserAvatars } from '@/services/firestore';
import { PATHS } from '@/router/paths';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { SMOOTH_TRANSITION, tabContentVariants } from '@/lib/animations'; 
import { PageMetadata } from '@/common/PageMetadata';

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

// # atualizado: Componente interno para renderizar o perfil real
const ProfileContent = ({ initialProfileUser }: { initialProfileUser: UserModel }) => {
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  
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
  
  const outletKey = location.pathname;

  const getCurrentTab = () => {
    const pathSegments = location.pathname.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    const tabs = ['posts', 'books', 'reviews', 'friends', 'activity'];

    if (tabs.includes(lastSegment)) {
      return lastSegment;
    }
    return 'posts';
  };

  const friendshipStatus = useFriendshipStatus(profileUser?.id || '');

  useEffect(() => {
    setProfileUser(initialProfileUser);
    setIsOwnProfile(currentUser?.uid === initialProfileUser?.id);
  }, [initialProfileUser, currentUser]);

  useEffect(() => {
    const fetchAvatarData = async () => {
      if (!profileUser?.id) return;
      try {
        const avatars = await getUserAvatars(profileUser.id);
        const currentAvatar = avatars.find(avatar => avatar.isCurrent);
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

  const handleEditProfile = () => {
    navigate(PATHS.PROFILE_EDIT);
  };

  const handleSendFriendRequest = async () => {
    if (!currentUser || !profileUser) return;
    setActionLoading(true);
    try {
      await sendDenormalizedFriendRequest(currentUser.uid, profileUser.id);
      toastSuccessClickable('Solicitação de amizade enviada!');
    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
      toastErrorClickable('Erro ao enviar solicitação de amizade');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePhotoUpdate = (newPhotoURL: string) => {
    setProfileUser(prev => ({ ...prev!, photoURL: newPhotoURL }));
    setShowPhotoEditor(false);
    if (isOwnProfile) {
      window.location.reload();
    }
  };

  if (!profileUser) {
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
                      {friendshipStatus === 'friends' ? (
                        <>
                          <Button variant="outline" className="rounded-full" disabled={actionLoading}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Amigos
                          </Button>
                          <Button
                            className="rounded-full bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => navigate(PATHS.CHAT({ receiverId: profileUser.id }))}
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Mensagem
                          </Button>
                        </>
                      ) : friendshipStatus === 'request_sent' ? (
                        <Button variant="outline" className="rounded-full" disabled>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Solicitação Enviada
                        </Button>
                      ) : friendshipStatus === 'request_received' ? (
                        <Button variant="outline" className="rounded-full" onClick={() => {}} disabled={actionLoading}>
                          <UserCheck className="h-4 w-4 mr-2" />
                          Responder Solicitação
                        </Button>
                      ) : (
                        <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSendFriendRequest} disabled={actionLoading}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Adicionar Amigo
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {profileUser.bio && (
                  <div
                    className="text-gray-700 mb-4 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: profileUser.bio }}
                  />
                )}
                <div className="space-y-2 text-sm text-gray-600">
                  {profileUser.location && (
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-3 text-gray-400" />
                      <span>{profileUser.location}</span>
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
                  {convertFirestoreDate(profileUser.birthDate) && (
                    <div className="flex items-center">
                      <Cake className="h-4 w-4 mr-3 text-gray-400" />
                      <span>
                        Nasceu em {format(convertFirestoreDate(profileUser.birthDate)!, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-3 text-gray-400" />
                    <span>
                      Membro {formatDistanceToNow(convertFirestoreDate(profileUser.joinedAt)!, { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="books">Livros</TabsTrigger>
              <TabsTrigger value="reviews">Resenhas</TabsTrigger>
              <TabsTrigger value="friends">Amigos</TabsTrigger>
              <TabsTrigger value="activity">Atividade</TabsTrigger>
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
            postDate={currentAvatarData.uploadedAt
              ? format(currentAvatarData.uploadedAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
              : "Data não disponível"}
          />
        )}

        {showPhotoEditor && (
          <AvatarEditorModal
            currentPhotoURL={profileUser.photoURL}
            onSave={handlePhotoUpdate}
            onCancel={() => setShowPhotoEditor(false)}
          />
        )}
      </main>
    </>
  );
};

export const Profile = () => {
  // # atualizado: useLoaderData agora retorna um objeto com promessas
  const data = useLoaderData() as { profileUser: Promise<UserModel> };

  return (
    // # atualizado: Suspense mostra o Skeleton enquanto a promessa de dados não é resolvida.
    <Suspense fallback={<ProfileSkeleton />}>
      {/* # atualizado: Await resolve a promessa do loader. */}
      <Await resolve={data.profileUser}>
        {/* # atualizado: Quando os dados chegam, renderiza o conteúdo real. */}
        {(resolvedProfileUser) => <ProfileContent initialProfileUser={resolvedProfileUser} />}
      </Await>
    </Suspense>
  );
}; 