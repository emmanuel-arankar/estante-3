import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, UserPlus, UserCheck, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Notification } from '@estante/common-types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
    notification: Notification;
    onMarkAsRead?: (notificationId: string) => void;
}

export const NotificationItem = ({ notification, onMarkAsRead }: NotificationItemProps) => {
    const getNotificationIcon = () => {
        switch (notification.type) {
            case 'FRIEND_REQUEST':
                return <UserPlus className="h-4 w-4 text-blue-500" />;
            case 'FRIEND_ACCEPTED':
                return <UserCheck className="h-4 w-4 text-green-500" />;
            case 'FRIEND_REJECTED':
                return <UserX className="h-4 w-4 text-red-500" />;
            default:
                return <Bell className="h-4 w-4 text-gray-500" />;
        }
    };

    const getNotificationText = () => {
        switch (notification.type) {
            case 'FRIEND_REQUEST':
                return (
                    <>
                        <span className="font-semibold">{notification.actorName}</span>
                        {' '}enviou uma solicitação de amizade
                    </>
                );
            case 'FRIEND_ACCEPTED':
                // isRequester = true: você enviou, alguém aceitou
                // isRequester = false: alguém enviou, você aceitou
                const isRequester = notification.metadata?.isRequester;

                if (isRequester) {
                    // Para quem enviou a solicitação
                    return (
                        <>
                            <span className="font-semibold">{notification.actorName}</span>
                            {' '}aceitou sua solicitação de amizade
                        </>
                    );
                } else {
                    // Para quem aceitou a solicitação
                    return (
                        <>
                            Você e <span className="font-semibold">{notification.actorName}</span>
                            {' '}agora são amigos
                        </>
                    );
                }
            case 'FRIEND_REJECTED':
                return (
                    <>
                        <span className="font-semibold">{notification.actorName}</span>
                        {' '}recusou sua solicitação de amizade
                    </>
                );
            default:
                return 'Notificação';
        }
    };

    const getNotificationLink = () => {
        switch (notification.type) {
            case 'FRIEND_REQUEST':
                return '/friends/requests';
            case 'FRIEND_ACCEPTED':
            case 'FRIEND_REJECTED':
                return `/profile/${notification.actorId}`;
            default:
                return '/notifications';
        }
    };

    const handleClick = () => {
        if (!notification.read && onMarkAsRead) {
            onMarkAsRead(notification.id);
        }
    };

    return (
        <Link
            to={getNotificationLink()}
            onClick={handleClick}
            className={cn(
                'flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors',
                !notification.read && 'bg-blue-50/50'
            )}
        >
            {/* Avatar com ícone sobreposto */}
            <div className="relative flex-shrink-0">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={notification.actorPhoto} alt={notification.actorName} />
                    <AvatarFallback className="bg-emerald-100 text-emerald-700">
                        {notification.actorName?.charAt(0) || '?'}
                    </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
                    {getNotificationIcon()}
                </div>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                    {getNotificationText()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                    {formatDistanceToNow(notification.createdAt, {
                        addSuffix: true,
                        locale: ptBR
                    })}
                </p>
            </div>

            {/* Badge não lido */}
            {!notification.read && (
                <div className="flex-shrink-0">
                    <div className="h-2 w-2 bg-blue-500 rounded-full" />
                </div>
            )}
        </Link>
    );
};
