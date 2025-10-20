import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { PATHS } from '@/router/paths';
import { withSuspense } from '@/router/RouteSuspense';
import { notificationsLoader } from '@/features/notifications/notifications.loaders';

const Notifications = lazy(() => import('../../pages/Notifications').then(module => ({ default: module.Notifications })));

export const notificationRoutes: RouteObject[] = [
  {
    path: PATHS.NOTIFICATIONS,
    element: withSuspense(Notifications),
    loader: notificationsLoader,
    handle: {
      id: 'notifications',
      title: () => 'Notificações | Estante de Bolso',
    },
  },
];