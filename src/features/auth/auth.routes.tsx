import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { loginAction, registerAction } from './auth.actions';
import { withSuspense } from '../../router/RouteSuspense';
import { PATHS } from '../../router/paths';
import { publicOnlyLoader } from './auth.loaders'; // # atualizado

const Login = lazy(() => import('../../pages/Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('../../pages/Register').then(module => ({ default: module.Register })));
const ForgotPassword = lazy(() => import('../../pages/ForgotPassword').then(module => ({ default: module.ForgotPassword })));

export const authRoutes: RouteObject[] = [
  {
    path: PATHS.LOGIN,
    element: withSuspense(Login),
    action: loginAction,
    loader: publicOnlyLoader, // # atualizado
    handle: {
      id: 'login',
      title: () => 'Login | Estante de Bolso',
    },
  },
  {
    path: PATHS.REGISTER,
    element: withSuspense(Register),
    action: registerAction,
    loader: publicOnlyLoader, // # atualizado
    handle: {
      id: 'register',
      title: () => 'Cadastro | Estante de Bolso',
    },
  },
  {
    path: PATHS.FORGOT_PASSWORD,
    element: withSuspense(ForgotPassword),
    loader: publicOnlyLoader, // # atualizado
    handle: {
      id: 'forgot-password',
      title: () => 'Recuperar Senha | Estante de Bolso',
    },
  },
];
