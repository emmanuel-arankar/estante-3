import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Bell, UserPlus, Heart, MessageCircle, UserCheck, X, Check } from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';
import { Button } from '@/components/ui/button';
import { 
  Avatar, 
  AvatarFallback, 
  AvatarImage 
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Card, 
  CardContent 
} from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  toastSuccessClickable, 
  toastErrorClickable 
} from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import {
  getUserNotifications,
  markNotificationAsRead,
  acceptFriendRequest,
  rejectFriendRequest,
  getUserById
} from '@/services/firestore';
import { Notification, User } from '@estante/common-types';

export const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userData, setUserData] = useState<{ [key: string]: User | null }>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const notificationsData = await getUserNotifications(user.uid);
      setNotifications(notificationsData);

      // Buscar dados dos usuários que enviaram as notificações
      const uniqueUserIds = Array.from(
        new Set(notificationsData.map(n => n.fromUserId))
      );

      const usersData: { [key: string]: User | null } = {};
      for (const userId of uniqueUserIds) {
        usersData[userId] = await getUserById(userId);
      }

      setUserData(usersData);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      toastErrorClickable('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId
            ? { ...notif, read: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const handleAcceptFriendRequest = async (notificationId: string, fromUserId: string) => {
    if (!user) return;

    setActionLoading(notificationId);
    try {
      await acceptFriendRequest(user.uid, fromUserId);
      await handleMarkAsRead(notificationId);
      toastSuccessClickable('Solicitação de amizade aceita!');
      await loadNotifications();
    } catch (error) {
      console.error('Erro ao aceitar solicitação:', error);
      toastErrorClickable('Erro ao aceitar solicitação');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectFriendRequest = async (notificationId: string, fromUserId: string) => {
    if (!user) return;

    setActionLoading(notificationId);
    try {
      await rejectFriendRequest(user.uid, fromUserId);
      await handleMarkAsRead(notificationId);
      toastSuccessClickable('Solicitação rejeitada');
      await loadNotifications();
    } catch (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      toastErrorClickable('Erro ao rejeitar solicitação');
    } finally {
      setActionLoading(null);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return <UserPlus className="h-5 w-5 text-blue-600" />;
      case 'friend_accept':
        return <UserCheck className="h-5 w-5 text-green-600" />;
      case 'like':
        return <Heart className="h-5 w-5 text-red-600" />;
      case 'comment':
        return <MessageCircle className="h-5 w-5 text-purple-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'friend_request':
        return 'bg-blue-50 border-blue-200';
      case 'friend_accept':
        return 'bg-green-50 border-green-200';
      case 'like':
        return 'bg-red-50 border-red-200';
      case 'comment':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <PageMetadata
        title="Notificações"
        description="Veja suas últimas atividades e interações na Estante de Bolso."
        noIndex={true}
      />

      <main className="min-h-[calc(100vh-80px)] bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Notificações</h1>
              <p className="text-gray-600">
                {notifications.filter(n => !n.read).length} não lidas
              </p>
            </div>

            {/* Notifications List */}
            <div className="space-y-4">
              {notifications.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Nenhuma notificação
                    </h3>
                    <p className="text-gray-600">
                      Quando houver atividade, você será notificado aqui
                    </p>
                  </CardContent>
                </Card>
              ) : (
                notifications.map((notification, index) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={`
                      ${!notification.read ? 'ring-2 ring-blue-200' : ''}
                      ${getNotificationColor(notification.type)}
                      hover:shadow-md transition-shadow
                    `}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-4">
                          {/* Avatar */}
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={userData[notification.fromUserId]?.photoURL ||
                                `https://api.dicebear.com/7.x/avataaars/svg?seed=${notification.fromUserId}`}
                              alt="Avatar"
                            />
                            <AvatarFallback>
                              {userData[notification.fromUserId]?.displayName?.charAt(0).toUpperCase() ||
                                notification.fromUserId.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          {/* Content */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  {getNotificationIcon(notification.type)}
                                  <p className="text-sm font-medium text-gray-900">
                                    <span className="font-semibold">
                                      {userData[notification.fromUserId]?.displayName ||
                                        `Usuário ${notification.fromUserId.slice(0, 8)}`}
                                    </span>
                                    {' '}{notification.message}
                                  </p>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {formatDistanceToNow(
                                    typeof notification.createdAt === 'string'
                                      ? new Date(notification.createdAt)
                                      : notification.createdAt,
                                    {
                                      addSuffix: true,
                                      locale: ptBR
                                    }
                                  )}
                                </p>
                              </div>

                              {/* Status */}
                              {!notification.read && (
                                <Badge className="bg-blue-600 text-white">
                                  Nova
                                </Badge>
                              )}
                            </div>

                            {/* Actions for friend requests */}
                            {notification.type === 'friend_request' && !notification.read && (
                              <div className="flex space-x-2 mt-3">
                                <Button
                                  size="sm"
                                  onClick={() => handleAcceptFriendRequest(notification.id, notification.fromUserId)}
                                  disabled={actionLoading === notification.id}
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                  {actionLoading === notification.id ? (
                                    <LoadingSpinner size="sm" />
                                  ) : (
                                    <>
                                      <Check className="h-3 w-3 mr-1" />
                                      Aceitar
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRejectFriendRequest(notification.id, notification.fromUserId)}
                                  disabled={actionLoading === notification.id}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Recusar
                                </Button>
                              </div>
                            )}

                            {/* Mark as read button */}
                            {!notification.read && notification.type !== 'friend_request' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="mt-2 text-xs"
                              >
                                Marcar como lida
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
};