import { lazy } from 'react';
import { Outlet, RouteObject } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { adminLoader } from '@/features/admin/admin.loaders';
import { withSuspense } from '@/router/RouteSuspense';

// Lazy loading do componente principal do dashboard
const AdminDashboard = lazy(() => import('../../pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })));

/**
 * # atualizado: O loader agora é exportado para ser pego pela rota lazy.
 * Ele executa a verificação de permissão ANTES da renderização do componente.
 */
export const loader = adminLoader;

/**
 * # atualizado: Este componente agora serve apenas como layout para as rotas admin.
 * A proteção foi movida para o 'loader', que é mais eficiente.
 */
export function Component() {
  // O RoleProtectedRoute não é mais necessário aqui.
  return <Outlet />;
}

Component.displayName = 'AdminLayout';

/**
 * # atualizado: O 'handle' é exportado para metadados da rota,
 * como breadcrumbs e título da página.
 */
export const handle = {
  id: 'admin-dashboard',
  title: () => 'Painel Admin | Estante de Bolso',
  breadcrumb: () => ({
    label: 'Admin',
    icon: <ShieldAlert className="h-4 w-4" />,
  }),
};

/**
 * # atualizado: As rotas filhas são exportadas.
 * O React Router as associará automaticamente ao 'Component' pai.
 */
export const children: RouteObject[] = [
  {
    index: true,
    element: withSuspense(AdminDashboard),
    // O handle do título foi movido para o pai, já que este é o índice.
  },
  // Futuras rotas filhas de admin podem ser adicionadas aqui.
  // Ex: { path: 'users', element: <UserManagement /> }
];