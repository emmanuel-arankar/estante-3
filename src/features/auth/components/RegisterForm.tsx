import { useState } from 'react';
import { Form, Link, useNavigation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Separator } from '@/components/ui/separator';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import { PATHS } from '@/router/paths';
import { googleAuthAPI } from '@/features/auth/services/authApi';
import { signInWithGoogle } from '@/services/firebase/auth';
import { trackEvent } from '@/lib/analytics';

export const RegisterForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const isFormSubmitting = navigation.state === 'submitting';
  const isSubmitting = isFormSubmitting || isGoogleLoading;

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      const user = result.user;

      const authResponse = await googleAuthAPI({
        uid: user.uid,
        email: user.email!,
        displayName: user.displayName || 'Novo Leitor',
        photoURL: user.photoURL,
      });

      if (authResponse.isNewUser) {
        toastSuccessClickable(`Bem-vindo(a), ${user.displayName || 'Novo Leitor'}! Sua conta foi criada.`);
        trackEvent('sign_up', { method: 'google' });
      } else {
        toastSuccessClickable(`Bem-vindo(a) de volta, ${user.displayName || 'Leitor'}!`);
        trackEvent('login', { method: 'google' });
      }

      navigate(PATHS.PROFILE_ME);
    } catch (error: any) {
      console.error('Erro no cadastro com Google:', error);
      toastErrorClickable('Não foi possível fazer cadastro com o Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl border-0">
      <CardHeader className="space-y-1 text-center">
        <CardTitle as="h1" className="text-2xl text-center font-sans tracking-tight">
          Criar Conta
        </CardTitle>
        <CardDescription className="text-gray-600 font-sans leading-relaxed">
          Crie sua conta para começar a organizar sua estante, descobrir novos livros e compartilhar suas leituras com a comunidade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form method="post" action={PATHS.REGISTER} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                name="displayName"
                placeholder="Seu nome completo"
                className="pl-10 font-sans"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="email"
                name="email"
                placeholder="Seu email principal"
                className="pl-10 font-sans"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Sua senha (mín. 6 caracteres)"
                className="pl-10 pr-10 font-sans"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-full font-sans shadow-md"
            disabled={isSubmitting}
            onClick={() => trackEvent('sign_up', { method: 'password' })}
          >
            {isFormSubmitting ? <LoadingSpinner size="sm" /> : 'Criar Conta'}
          </Button>
        </Form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500 font-sans font-medium">
              Ou continue com
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          type="button"
          onClick={handleGoogleLogin}
          className="w-full rounded-full font-sans border-gray-200 hover:bg-gray-50 hover:text-emerald-700 transition-all"
          disabled={isSubmitting}
        >
          {isGoogleLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <>
              <Chrome className="h-4 w-4 mr-2" />
              Google
            </>
          )}
        </Button>

        <div className="text-center text-sm mt-6">
          <span className="text-gray-600 font-sans">Já tem uma conta? </span>
          <Link to={PATHS.LOGIN} className="text-emerald-600 hover:text-emerald-700 font-medium font-sans hover:underline">
            Faça login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};