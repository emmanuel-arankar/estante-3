import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Bell, CheckCheck } from 'lucide-react';
import { db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PageMetadata } from '@/components/seo/PageMetadata';
import type { Notification } from '@estante/common-types';

export const NotificationsPage = () => {
    const { user } = useAuth();
    const { markAsRead, markAllAsRead } = useNotifications();
    const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    // Buscar todas as notificações (não apenas não lidas)
    useEffect(() => {
        if (!user?.uid) return;

        const fetchAllNotifications = async () => {
            setIsLoading(true);
            try {
                const notificationsQuery = query(
                    collection(db, 'notifications'),
                    where('userId', '==', user.uid),
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );

                const snapshot = await getDocs(notificationsQuery);
                const notifs = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        userId: data.userId,
                        type: data.type,
                        actorId: data.actorId,
                        actorName: data.actorName,
                        actorPhoto: data.actorPhoto,
                        read: data.read,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        metadata: data.metadata
                    } as Notification;
                });

                setAllNotifications(notifs);
            } catch (error) {
                console.error('Error fetching notifications:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllNotifications();
    }, [user?.uid]);

    const filteredNotifications = filter === 'unread'
        ? allNotifications.filter(n => !n.read)
        : allNotifications;

    const unreadCount = allNotifications.filter(n => !n.read).length;

    return (
        <>
            <PageMetadata
                title="Notificações"
                description="Veja todas as suas notificações"
            />

            <main className="min-h-screen bg-gray-50 pt-20">
                <div className="max-w-3xl mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
                            {unreadCount > 0 && (
                                <p className="text-sm text-gray-500 mt-1">
                                    {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
                                </p>
                            )}
                        </div>

                        {unreadCount > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markAllAsRead()}
                                className="gap-2"
                            >
                                <CheckCheck className="h-4 w-4" />
                                Marcar todas como lidas
                            </Button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 mb-4">
                        <Button
                            variant={filter === 'all' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setFilter('all')}
                        >
                            Todas
                        </Button>
                        <Button
                            variant={filter === 'unread' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setFilter('unread')}
                        >
                            Não lidas {unreadCount > 0 && `(${unreadCount})`}
                        </Button>
                    </div>

                    {/* Notifications List */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <LoadingSpinner />
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <Bell className="h-16 w-16 text-gray-300 mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    {filter === 'unread' ? 'Nenhuma notificação nova' : 'Nenhuma notificação'}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {filter === 'unread'
                                        ? 'Você está em dia com suas notificações!'
                                        : 'Quando algo acontecer, você verá aqui.'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200">
                                {filteredNotifications.map((notification) => (
                                    <NotificationItem
                                        key={notification.id}
                                        notification={notification}
                                        onMarkAsRead={markAsRead}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
};
