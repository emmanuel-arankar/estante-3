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
} from '@/features/routes';

const Home = lazy(() => import('@/pages/Home').then(module => ({ default: module.Home })));

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

      // --- Rotas de Gestão (Perfil Protegido, Admin, etc.) ---
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <ContainedLayout />,
            children: [
              ...protectedProfileRoutes,
              {
                path: PATHS.ADMIN_DASHBOARD,
                lazy: () => import('@/features/admin/admin.routes'),
              },
              {
                path: PATHS.NOTIFICATIONS,
                lazy: () => import('@/pages/Notifications').then(module => ({ Component: module.NotificationsPage })),
              },
              {
                path: PATHS.SETTINGS_BLOCKED,
                lazy: () => import('@/pages/settings/BlockedUsers').then(module => ({ Component: module.BlockedUsers })),
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