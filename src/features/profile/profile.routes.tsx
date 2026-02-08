import { lazy } from 'react';
import { RouteObject, Outlet } from 'react-router-dom';
import { User, Edit3 } from 'lucide-react';
import {
  profileLoader,
  editProfileLoader,
  meProfileLoader,
} from '@/features/profile/profile.loaders';
import { editProfileAction } from '@/features/profile/profile.actions';
import { ErrorElement } from '@/router/ErrorElement';
import {
  PATHS,
  ROUTE_PATTERNS
} from '@/router/paths';
import { withSuspense } from '@/router/RouteSuspense';

const Profile = lazy(() => import('@/pages/Profile').then(module => ({ default: module.Profile })));
const EditProfile = lazy(() => import('@/pages/EditProfile').then(module => ({ default: module.EditProfile })));

const ProfileLayout = () => <Outlet />;

// Componentes placeholder
const ProfileBooks = () => <div className="text-center py-8 text-gray-500"><p>Nenhum livro na estante ainda.</p></div>;
const ProfileReviews = () => <div className="text-center py-8 text-gray-500"><p>Nenhuma resenha ainda.</p></div>;
const ProfileFriends = () => <div className="text-center py-8 text-gray-500"><p>A lista de amigos aparecerá aqui.</p></div>;
const ProfileActivity = () => <div className="text-center py-8 text-gray-500"><p>A atividade recente aparecerá aqui.</p></div>;

// Rotas de abas
const profileTabRoutes: RouteObject[] = [
  { index: true, element: <ProfileActivity /> },
  { path: PATHS.PROFILE_ACTIVITY, element: <ProfileActivity /> },
  { path: PATHS.PROFILE_BOOKS, element: <ProfileBooks /> },
  { path: PATHS.PROFILE_REVIEWS, element: <ProfileReviews /> },
  { path: PATHS.PROFILE_FRIENDS, element: <ProfileFriends /> },
];

// Rota de perfis públicos
export const profileRoutes: RouteObject[] = [
  {
    path: ROUTE_PATTERNS.PROFILE,
    element: withSuspense(Profile),
    loader: profileLoader,
    errorElement: <ErrorElement />,
    handle: {
      id: 'profile',
      breadcrumb: (data: any) => ({
        label: data?.displayName || 'Perfil',
        icon: <User className="h-4 w-4" />,
      }),
      title: (data: any) => `${data?.displayName || 'Perfil'} | Estante de Bolso`,
    },
    children: profileTabRoutes,
  },
];

// Rotas de perfis privados
export const protectedProfileRoutes: RouteObject[] = [
  {
    path: PATHS.PROFILE_ME,
    element: <ProfileLayout />,
    handle: {
      breadcrumb: () => ({
        id: 'profile-me',
        label: 'Meu Perfil',
        icon: <User className="h-4 w-4" />,
      }),
    },
    children: [
      {
        element: withSuspense(Profile),
        loader: meProfileLoader,
        errorElement: <ErrorElement />,
        handle: {
          id: 'profile-edit',
          title: () => 'Meu Perfil | Estante de Bolso',
        },
        children: profileTabRoutes,
      },
      {
        path: 'edit',
        element: withSuspense(EditProfile),
        loader: editProfileLoader,
        action: editProfileAction,
        handle: {
          breadcrumb: () => ({
            label: 'Editar',
            icon: <Edit3 className="h-4 w-4" />,
          }),
          title: () => 'Editar Perfil | Estante de Bolso',
        },
      },
    ],
  },
];
