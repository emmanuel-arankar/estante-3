import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, UserPlus, UserCheck, UserX, Heart, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
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
            case 'friend_request':
                return <UserPlus className="h-4 w-4 text-blue-500" />;
            case 'friend_accepted':
                return <UserCheck className="h-4 w-4 text-green-500" />;
            case 'friend_rejected':
                return <UserX className="h-4 w-4 text-red-500" />;
            case 'like_review':
            case 'like_review_comment':
                return <Heart className="h-4 w-4 text-red-500" />;
            case 'review_comment_created':
            case 'comment_reply_created':
                return <MessageSquare className="h-4 w-4 text-emerald-500" />;
            case 'suggestion_approved':
                return <CheckCircle className="h-4 w-4 text-emerald-500" />;
            case 'suggestion_rejected':
                return <XCircle className="h-4 w-4 text-red-500" />;
            default:
                return <Bell className="h-4 w-4 text-gray-500" />;
        }
    };

    const getNotificationText = () => {
        const actorName = notification.actorName || 'Alguém';

        switch (notification.type) {
            case 'friend_request':
                return (
                    <>
                        <span className="font-semibold">{actorName}</span>
                        {' '}enviou uma solicitação de amizade
                    </>
                );
            case 'friend_accepted':
                // isRequester = true: você enviou, alguém aceitou
                // isRequester = false: alguém enviou, você aceitou
                const isRequester = notification.metadata?.isRequester;

                if (isRequester) {
                    // Para quem enviou a solicitação
                    return (
                        <>
                            <span className="font-semibold">{actorName}</span>
                            {' '}aceitou sua solicitação de amizade
                        </>
                    );
                } else {
                    // Para quem aceitou a solicitação
                    return (
                        <>
                            Você e <span className="font-semibold">{actorName}</span>
                            {' '}agora são amigos
                        </>
                    );
                }
            case 'friend_rejected':
                return (
                    <>
                        <span className="font-semibold">{actorName}</span>
                        {' '}recusou sua solicitação de amizade
                    </>
                );
            case 'like_review':
                return (
                    <>
                        <span className="font-semibold">{actorName}</span>
                        {' '}curtiu sua resenha
                    </>
                );
            case 'like_review_comment':
                return (
                    <>
                        <span className="font-semibold">{actorName}</span>
                        {' '}curtiu seu comentário
                    </>
                );
            case 'review_comment_created':
                return (
                    <>
                        <span className="font-semibold">{actorName}</span>
                        {' '}comentou na sua resenha
                    </>
                );
            case 'comment_reply_created':
                return (
                    <>
                        <span className="font-semibold">{actorName}</span>
                        {' '}respondeu ao seu comentário
                    </>
                );
            case 'suggestion_approved': {
                const title = notification.metadata?.suggestionTitle;
                return (
                    <>
                        Sua sugestão{title ? <> de <span className="font-semibold">{title}</span></> : ''} foi <span className="font-semibold text-emerald-600">aprovada!</span> 🎉
                    </>
                );
            }
            case 'suggestion_rejected': {
                const title = notification.metadata?.suggestionTitle;
                return (
                    <>
                        Sua sugestão{title ? <> de <span className="font-semibold">{title}</span></> : ''} foi <span className="font-semibold text-red-600">rejeitada</span>.
                    </>
                );
            }
            default:
                return `Nova notificação${actorName !== 'Alguém' ? ` de ${actorName}` : ''}`;
        }
    };

    const getNotificationLink = () => {
        switch (notification.type) {
            case 'friend_request':
                return '/friends/requests';
            case 'friend_accepted':
            case 'friend_rejected':
                // Usar actorNickname se disponível no metadata, senão fallback para /friends
                if (notification.metadata?.actorNickname) {
                    return `/profile/${notification.metadata.actorNickname}`;
                }
                return '/friends';
            case 'like_review':
            case 'like_review_comment':
            case 'review_comment_created':
            case 'comment_reply_created':
                if (notification.metadata?.editionId) {
                    return `/book/${notification.metadata.editionId}`;
                }
                if (notification.metadata?.workId) {
                    return `/work/${notification.metadata.workId}`;
                }
                return '/notifications';
            case 'suggestion_approved':
            case 'suggestion_rejected':
                // Leva para a página de notificações onde o usuário pode ver o histórico
                return '/notifications';
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
                {/* Nota de justificativa (apenas para sugestões) */}
                {(notification.type === 'suggestion_approved' || notification.type === 'suggestion_rejected') &&
                    notification.metadata?.reviewNote && (
                    <p className="text-xs text-gray-400 mt-0.5 italic line-clamp-1">
                        "{notification.metadata.reviewNote}"
                    </p>
                )}
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