import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { withSuspense } from '../../router/RouteSuspense';
import { ROUTE_PATTERNS, PATHS } from '../../router/paths';

const Messages = lazy(() => import('../../pages/Messages').then(module => ({ default: module.Messages })));
const Chat = lazy(() => import('../../pages/Chat').then(module => ({ default: module.Chat })));

export const protectedChatRoutes: RouteObject[] = [
  {
    path: PATHS.MESSAGES,
    element: withSuspense(Messages),
    handle: {
      id: 'messages',
      title: () => 'Mensagens | Estante de Bolso',
    },
  },
  {
    path: ROUTE_PATTERNS.CHAT,
    element: withSuspense(Chat),
    handle: {
      id: 'chat',
      title: () => 'Chat | Estante de Bolso',
    },
  },
];
