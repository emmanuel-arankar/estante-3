import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import type { Notification } from '@estante/common-types';

export const useNotifications = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Listener para notificações não lidas (real-time)
    useEffect(() => {
        if (!user?.uid) {
            setNotifications([]);
            setUnreadCount(0);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid),
            where('read', '==', false),
            orderBy('createdAt', 'desc'),
            limit(20) // Últimas 20 não lidas
        );

        const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
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

            setNotifications(notifs);
            setUnreadCount(notifs.length);
            setIsLoading(false);
        }, (error) => {
            console.error('Error fetching notifications:', error);
            setIsLoading(false);
        });

        return unsubscribe;
    }, [user?.uid]);

    // Marcar notificação como lida
    const markAsRead = async (notificationId: string) => {
        try {
            const notifRef = doc(db, 'notifications', notificationId);
            await updateDoc(notifRef, {
                read: true,
                readAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    };

    // Marcar todas como lidas
    const markAllAsRead = async () => {
        try {
            const promises = notifications.map(notif =>
                updateDoc(doc(db, 'notifications', notif.id), {
                    read: true,
                    readAt: Timestamp.now()
                })
            );
            await Promise.all(promises);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    };

    return {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead
    };
};
