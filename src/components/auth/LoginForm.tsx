import { useState } from 'react';
import { Form, Link, useNavigation, useNavigate, useLocation } from 'react-router-dom'; 
import { Eye, EyeOff, Mail, Lock, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PATHS } from '@/router/paths';
import { 
  GoogleAuthProvider, 
  signInWithPopup,
  getAdditionalUserInfo 
} from 'firebase/auth'; // # atualizado
import { auth, db } from '@/services/firebase'; // # atualizado
import { doc, setDoc } from 'firebase/firestore';
import { generateUniqueNickname } from '@/utils/nickname'; // # atualizado
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast'; // # atualizado
import { User } from '@/models'; // # atualizado
import { Label } from "@/components/ui/label";

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

  // # atualizado: Lógica completa para login com Google
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const additionalInfo = getAdditionalUserInfo(result);

      // Verifica se é um novo usuário
      if (additionalInfo?.isNewUser) {
        const userDocRef = doc(db, 'users', user.uid);
        const nickname = await generateUniqueNickname(user.displayName || 'Leitor');

        const newProfileData: Omit<User, 'id'> = {
          displayName: user.displayName || 'Novo Leitor',
          nickname,
          email: user.email!,
          photoURL: user.photoURL || '',
          bio: '',
          location: '',
          website: '',
          joinedAt: new Date(),
          booksRead: 0,
          currentlyReading: 0,
          followers: 0,
          following: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await setDoc(userDocRef, newProfileData);
        toastSuccessClickable(`Bem-vindo(a), ${user.displayName}! Sua conta foi criada.`);
      } else {
        toastSuccessClickable(`Bem-vindo(a) de volta, ${user.displayName}!`);
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
          {/* # atualizado: Adicionado campo oculto para enviar a URL de redirecionamento */}
          <input type="hidden" name="redirectTo" value={from} />

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
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Sua senha"
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

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label htmlFor="rememberMe" className="cursor-pointer">
                Lembrar de mim
              </Label>
            </div>
            <Link
              to={PATHS.FORGOT_PASSWORD}
              className="text-sm text-emerald-600 hover:underline font-sans"
            >
              Esqueci minha senha
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-full font-sans"
            disabled={isSubmitting}
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : 'Entrar'}
          </Button>
        </Form>

        <Separator />

        <Button
          variant="outline"
          onClick={handleGoogleLogin}
          className="w-full rounded-full font-sans"
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