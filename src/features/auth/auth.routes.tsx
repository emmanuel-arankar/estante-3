import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { loginAction, registerAction } from '@/features/auth/auth.actions';
import { publicOnlyLoader } from '@/features/auth/auth.loaders';
import { PATHS } from '@/router/paths';
import { withSuspense } from '@/router/RouteSuspense';

const Login = lazy(() => import('@/features/auth/pages/LoginPage').then(module => ({ default: module.LoginPage })));
const Register = lazy(() => import('@/features/auth/pages/RegisterPage').then(module => ({ default: module.RegisterPage })));
const ForgotPassword = lazy(() => import('@/features/auth/pages/ForgotPasswordPage').then(module => ({ default: module.ForgotPasswordPage })));
const AuthLayout = lazy(() => import('@/features/auth/components/AuthLayout').then(module => ({ default: module.AuthLayout })));

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