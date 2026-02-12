import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PATHS } from '@/router/paths';

export const NotificationDropdown = () => {
    const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative rounded-full"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-96" sideOffset={22}>
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b">
                    <h3 className="font-semibold text-sm">Notificações</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAllAsRead()}
                            className="text-xs text-blue-600 hover:text-blue-700 h-auto p-1"
                        >
                            Marcar todas como lidas
                        </Button>
                    )}
                </div>

                {/* Notification List */}
                <div className="max-h-96 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <LoadingSpinner size="sm" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                            <Bell className="h-12 w-12 text-gray-300 mb-2" />
                            <p className="text-sm text-gray-500">Nenhuma notificação nova</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.slice(0, 10).map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkAsRead={markAsRead}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <div className="p-2">
                            <Link to={PATHS.NOTIFICATIONS}>
                                <Button variant="ghost" className="w-full text-sm text-blue-600 hover:text-blue-700">
                                    Ver todas as notificações
                                </Button>
                            </Link>
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
