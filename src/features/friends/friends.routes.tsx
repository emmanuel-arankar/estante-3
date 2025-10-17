import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { withSuspense } from '../../router/RouteSuspense';
import { PATHS } from '../../router/paths';

// O componente Friends se torna o layout para esta seção
const Friends = lazy(() => import('../../pages/Friends').then(module => ({ default: module.Friends })));

// O DenormalizedFriendsList agora será renderizado pelo Outlet
const DenormalizedFriendsList = lazy(() => import('../../components/friends/DenormalizedFriendsList').then(module => ({ default: module.DenormalizedFriendsList })));

export const friendsRoutes: RouteObject[] = [
  {
    path: PATHS.FRIENDS,
    element: withSuspense(Friends),
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