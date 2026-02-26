import { useState, useMemo } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PageMetadata } from '@/components/seo/PageMetadata';

export const NotificationsPage = () => {
    const {
        notifications,
        unreadCount,
        isLoading,
        isLoadingMore,
        hasMore,
        loadMore,
        markAsRead,
        markAllAsRead,
    } = useNotifications();
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const filteredNotifications = useMemo(() =>
        filter === 'unread'
            ? notifications.filter(n => !n.read)
            : notifications,
        [notifications, filter]
    );

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
                            <>
                                <div className="divide-y divide-gray-200">
                                    {filteredNotifications.map((notification) => (
                                        <NotificationItem
                                            key={notification.id}
                                            notification={notification}
                                            onMarkAsRead={markAsRead}
                                        />
                                    ))}
                                </div>

                                {/* Botão "Carregar Mais" */}
                                {hasMore && filter === 'all' && (
                                    <div className="flex justify-center py-4 border-t border-gray-200">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={loadMore}
                                            disabled={isLoadingMore}
                                            className="gap-2"
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Carregando...
                                                </>
                                            ) : (
                                                'Carregar mais notificações'
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
};
