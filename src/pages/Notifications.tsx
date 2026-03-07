import { useState, useMemo } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

            <main className="h-[calc(100vh-80px)] w-full max-w-6xl mx-auto px-4 pt-8 pb-8 flex flex-col">
                <div className="shrink-0">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Notificações</h1>
                            <p className="text-gray-600">
                                {unreadCount > 0
                                    ? `${unreadCount} ${unreadCount === 1 ? 'nova não lida' : 'novas não lidas'}`
                                    : 'Nenhuma notificação nova'
                                }
                            </p>
                        </div>

                        {unreadCount > 0 && (
                            <Button
                                variant="outline"
                                onClick={() => markAllAsRead()}
                                className="bg-white hover:bg-gray-50 text-gray-700"
                            >
                                <CheckCheck className="h-4 w-4 mr-2" />
                                Marcar todas como lidas
                            </Button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="mb-6">
                        <Tabs value={filter} onValueChange={(val: string) => setFilter(val as 'all' | 'unread')} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="all" className="flex items-center justify-center space-x-2">
                                    <span>Todas</span>
                                </TabsTrigger>
                                <TabsTrigger value="unread" className="flex items-center justify-center space-x-2">
                                    <span>Não lidas {unreadCount > 0 && `(${unreadCount})`}</span>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                {/* Notifications List Card */}
                <div className="flex-1 overflow-hidden border border-gray-200 shadow-sm rounded-xl bg-white flex flex-col">
                    <div className="p-0 flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <LoadingSpinner />
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                                <Bell className="h-16 w-16 text-gray-300 mb-4" />
                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    {filter === 'unread' ? 'Nenhuma notificação nova' : 'Nenhuma notificação'}
                                </h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    {filter === 'unread'
                                        ? 'Você está em dia com suas notificações!'
                                        : 'Quando algo acontecer, você verá aqui.'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="divide-y divide-gray-100">
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
