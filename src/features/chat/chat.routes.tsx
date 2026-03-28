import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { ROUTE_PATTERNS, PATHS } from '@/router/paths';
import { withSuspense } from '@/router/RouteSuspense';

const Messages = lazy(() => import('@/features/chat/pages/MessagesPage').then(module => ({ default: module.MessagesPage })));
const Chat = lazy(() => import('@/features/chat/pages/ChatPage').then(module => ({ default: module.ChatPage })));

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
