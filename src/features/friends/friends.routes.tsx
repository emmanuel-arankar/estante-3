import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { PATHS } from '@/router/paths';
import { withSuspense } from '@/router/RouteSuspense';

// O componente FriendsPage se torna o layout para esta seção
const FriendsPage = lazy(() => import('@/features/friends/pages/FriendsPage').then(module => ({ default: module.FriendsPage })));

// O DenormalizedFriendsList agora será renderizado pelo Outlet
const DenormalizedFriendsList = lazy(() => import('@/features/friends/components/DenormalizedFriendsList').then(module => ({ default: module.DenormalizedFriendsList })));

export const friendsRoutes: RouteObject[] = [
  {
    path: PATHS.FRIENDS,
    element: withSuspense(FriendsPage),
    handle: {
      id: 'friends',
      title: () => 'Amigos | Estante de Bolso',
    },
    children: [
      {
        index: true, 
        element: withSuspense(DenormalizedFriendsList)
      },
      {
        path: PATHS.FRIENDS_REQUESTS,
        element: withSuspense(DenormalizedFriendsList),
      },
      {
        path: PATHS.FRIENDS_SENT,
        element: withSuspense(DenormalizedFriendsList)
      }
    ]
  },
];
