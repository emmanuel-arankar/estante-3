import * as React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../models';
import { PATHS } from './paths';
import { useQuery } from '@tanstack/react-query';
import { userQuery } from '../features/users/user.queries';

// # atualizado: Adicionando a propriedade 'children' à interface
interface RoleProtectedRouteProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

export const RoleProtectedRoute = ({ allowedRoles, children }: RoleProtectedRouteProps) => {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    ...userQuery(user?.uid || ''),
    enabled: !!user?.uid,
  });

  if (!profile) {
    return <Navigate to={PATHS.HOME} replace />;
  }

  const userRole = profile.role || 'user';

  // # atualizado: Renderiza os 'children' se eles forem passados, senão, renderiza o <Outlet />.
  // Isso torna o componente versátil para ambos os usos.
  return allowedRoles.includes(userRole)
    ? <>{children || <Outlet />}</>
    : <Navigate to={PATHS.HOME} replace />; // Redireciona para a home se não tiver permissão
};
