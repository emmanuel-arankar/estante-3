import { useState } from 'react';
import { Form, Link, useNavigation, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Separator } from '@/components/ui/separator';
import {
  toastSuccessClickable,
  toastErrorClickable
} from '@/components/ui/toast';
import { PATHS } from '@/router/paths';
import { googleAuthAPI } from '@/features/auth/services/authApi';
import { signInWithGoogle } from '@/services/firebase/auth';
import { trackEvent } from '@/lib/analytics';

export const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigation = useNavigation();
  const navigate = useNavigate(); // # atualizado
  const location = useLocation(); // # atualizado
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // # atualizado
  const isSubmitting = navigation.state === 'submitting' || isGoogleLoading; // # atualizado

  // # atualizado: Obtém a rota de origem, se existir
  const from = location.state?.from?.pathname || '/';

  // # atualizado: Lógica completa para login com Google centralizada no backend
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      const user = result.user;

      // Chama o backend para criar o documento Firestore se for novato
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
      console.error('Erro no login com Google:', error);
      toastErrorClickable('Não foi possível fazer login com o Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="space-y-1">
        <CardTitle as="h1" className="text-2xl text-center font-sans">
          Entrar
        </CardTitle>
        <CardDescription className="text-center text-gray-600 font-sans">
          Entre em sua conta para continuar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form method="post" action={PATHS.LOGIN} className="space-y-4">
          {/* # atualizado: Redirecionamento e Lembrar de mim */}
          <input type="hidden" name="redirectTo" value={from} />
          <input type="hidden" name="rememberMe" value={rememberMe ? 'true' : 'false'} />

          <div className="space-y-2">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="email"
                name="email"
                placeholder="Seu email"
                className="pl-10 font-sans"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <Label htmlFor="password">Sua senha</Label>
              <Link
                to={PATHS.FORGOT_PASSWORD}
                className="text-xs text-emerald-600 hover:underline font-sans font-medium"
              >
                Esqueci minha senha
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Digite sua senha"
                className="pl-10 pr-10 font-sans"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 px-1">
            <Checkbox
              id="rememberMe"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
            />
            <Label htmlFor="rememberMe" className="text-sm cursor-pointer text-gray-600">
              Lembrar de mim
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-full font-sans"
            disabled={isSubmitting}
            onClick={() => trackEvent('login', { method: 'password' })}
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : 'Entrar'}
          </Button>
        </Form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500 font-sans font-medium">
              Ou acesse com sua conta
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={handleGoogleLogin}
          className="w-full rounded-full font-sans border-gray-200 hover:bg-gray-50 hover:text-emerald-700 transition-all"
          disabled={isSubmitting}
        >
          <Chrome className="h-4 w-4 mr-2" />
          Entrar com Google
        </Button>

        <div className="text-center text-sm">
          <span className="text-gray-600 font-sans">Não tem uma conta? </span>
          <Link to={PATHS.REGISTER} className="text-emerald-600 hover:underline font-medium font-sans">
            Cadastre-se
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};