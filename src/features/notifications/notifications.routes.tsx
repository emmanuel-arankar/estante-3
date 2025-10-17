import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { withSuspense } from '../../router/RouteSuspense';
import { notificationsLoader } from './notifications.loaders';
import { PATHS } from '../../router/paths';

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