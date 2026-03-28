import { lazy } from 'react';
import { RouteObject, ScrollRestoration } from 'react-router-dom';
import { PATHS } from '@/router/paths';

// Layout e Utilitários
import { Layout } from '@/components/layout/Layout';
import { ContainedLayout } from '@/components/layout/ContainedLayout';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { withSuspense } from '@/router/RouteSuspense';
import { NotFound } from '@/pages/NotFound';
import { ErrorElement } from '@/router/ErrorElement';

// Loaders
import { layoutLoader } from '@/router/loaders';

// Módulos de Rota
import {
  authRoutes,
  profileRoutes,
  protectedProfileRoutes,
  friendsRoutes,
  protectedChatRoutes,
  booksRoutes,
} from '@/features/routes';

const Home = lazy(() => import('@/features/home/pages/HomePage').then(module => ({ default: module.HomePage })));

export const routes: RouteObject[] = [
  {
    element: (
      <>
        <Layout />
        <ScrollRestoration />
      </>
    ),
    errorElement: <ErrorElement />,
    loader: layoutLoader,
    children: [
      // --- Rotas de Tela Cheia (sem container) ---
      {
        path: PATHS.HOME,
        element: withSuspense(Home),
        handle: {
          id: 'home',
          title: () => 'Estante de Bolso - Sua rede social de leitura',
        },
      },
      ...authRoutes,
      ...booksRoutes,

      // --- Rotas de Gestão (Perfil Protegido, Admin, etc.) ---
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <ContainedLayout />,
            children: [
              ...protectedProfileRoutes,
              {
                path: PATHS.CURATOR_DASHBOARD,
                lazy: () => import('@/features/curatorship/curatorship.routes'),
              },
              {
                path: PATHS.CURATOR_EDIT_WORK({ workId: ':workId' }).split(':')[0] + ':workId/edit',
                lazy: () => import('@/features/curatorship/pages/AdminEditWorkPage').then(m => ({ Component: m.AdminEditWorkPage })),
              },
              {
                path: PATHS.CURATOR_EDIT_EDITION({ editionId: ':editionId' }).split(':')[0] + ':editionId/edit',
                lazy: () => import('@/features/curatorship/pages/AdminEditEditionPage').then(m => ({ Component: m.AdminEditEditionPage })),
              },
              {
                path: PATHS.CURATOR_EDIT_PERSON({ personId: ':personId' }).split(':')[0] + ':personId/edit',
                lazy: () => import('@/features/curatorship/pages/AdminEditPersonPage').then(m => ({ Component: m.AdminEditPersonPage })),
              },
              {
                path: PATHS.CURATOR_EDIT_PUBLISHER({ publisherId: ':publisherId' }).split(':')[0] + ':publisherId/edit',
                lazy: () => import('@/features/curatorship/pages/AdminEditPublisherPage').then(m => ({ Component: m.AdminEditPublisherPage })),
              },
              {
                path: PATHS.NOTIFICATIONS,
                lazy: () => import('@/features/notifications/pages/NotificationsPage').then(module => ({ Component: module.NotificationsPage })),
              },
              {
                path: PATHS.SETTINGS_BLOCKED,
                lazy: () => import('@/features/friends/pages/BlockedUsersPage').then(module => ({ Component: module.BlockedUsersPage })),
              },
            ],
          },
          // Chat e Friends fora do ContainedLayout para ocupar tela cheia
          ...friendsRoutes,
          ...protectedChatRoutes,
        ],
      },

      // Perfil público (se houver routes não protegidas)
      ...profileRoutes,
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
];
