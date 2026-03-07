import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { loginAction, registerAction } from '@/features/auth/auth.actions';
import { publicOnlyLoader } from '@/features/auth/auth.loaders';
import { PATHS } from '@/router/paths';
import { withSuspense } from '@/router/RouteSuspense';

const Login = lazy(() => import('@/pages/Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('@/pages/Register').then(module => ({ default: module.Register })));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword').then(module => ({ default: module.ForgotPassword })));
const AuthLayout = lazy(() => import('@/components/auth/AuthLayout').then(module => ({ default: module.AuthLayout })));

export const authRoutes: RouteObject[] = [
  {
    element: withSuspense(AuthLayout),
    handle: { id: 'auth-layout' },
    children: [
      {
        path: PATHS.LOGIN,
        element: withSuspense(Login),
        action: loginAction,
        loader: publicOnlyLoader,
        handle: {
          id: 'auth',
          title: () => 'Login | Estante de Bolso',
        },
      },
      {
        path: PATHS.REGISTER,
        element: withSuspense(Register),
        action: registerAction,
        loader: publicOnlyLoader,
        handle: {
          id: 'auth',
          title: () => 'Cadastro | Estante de Bolso',
        },
      },
      {
        path: PATHS.FORGOT_PASSWORD,
        element: withSuspense(ForgotPassword),
        loader: publicOnlyLoader,
        handle: {
          id: 'auth',
          title: () => 'Recuperar Senha | Estante de Bolso',
        },
      },
    ],
  },
];
