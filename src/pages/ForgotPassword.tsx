import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';
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
import { 
  toastSuccessClickable, 
  toastErrorClickable 
} from '@/components/ui/toast';
import { auth } from '@/services/firebase';
import { PATHS } from '@/router/paths';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const ForgotPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, data.email, {
        url: `${window.location.origin}${PATHS.LOGIN}`,
        handleCodeInApp: false,
      });

      setEmailSent(true);
      toastSuccessClickable('Email de recuperação enviado com sucesso! Verifique sua caixa de entrada e spam.');
    } catch (error: any) {
      console.error('Erro ao enviar email:', error);

      let errorMessage = 'Erro ao enviar email de recuperação';

      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Nenhum usuário encontrado com este email';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Muitas tentativas. Tente novamente mais tarde';
          break;
        case 'auth/missing-android-pkg-name':
        case 'auth/missing-continue-uri':
        case 'auth/missing-ios-bundle-id':
        case 'auth/invalid-continue-uri':
        case 'auth/unauthorized-continue-uri':
          errorMessage = 'Erro de configuração. Contate o suporte';
          break;
        default:
          errorMessage = 'Erro ao enviar email. Tente novamente';
      }

      toastErrorClickable(errorMessage);
      form.setError('email', { message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <main className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4 w-full overflow-x-hidden">
        <div className="w-full max-w-md">
          <Card className="shadow-xl">
            <CardContent className="p-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="bg-green-100 p-4 rounded-full">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  Email Enviado!
                </h1>
                <p className="text-gray-600">
                  Enviamos um link de recuperação para o seu email.
                  Verifique sua caixa de entrada e spam.
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  asChild
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <Link to={PATHS.LOGIN}>
                    Voltar ao Login
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailSent(false);
                    form.reset();
                  }}
                  className="w-full"
                >
                  Enviar Novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <>
      <PageMetadata
        title="Recuperar Senha"
        description="Esqueceu sua senha? Recupere seu acesso à sua conta da Estante de Bolso."
        noIndex={true}
      />

      <main className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4 w-full overflow-x-hidden">
        <div className="w-full max-w-md">
          <Card className="shadow-xl">
            <CardHeader className="space-y-1">
              <div className="flex items-center space-x-2 mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="rounded-full"
                >
                  <Link to={PATHS.LOGIN}>
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <CardTitle as="h1" className="text-2xl">
                  Recuperar Senha
                </CardTitle>
              </div>
              <CardDescription className="text-center text-gray-600">
                Digite seu email para receber o link de recuperação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* O formulário e o restante do conteúdo permanecem os mesmos */}
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      placeholder="Seu email cadastrado"
                      className="pl-10"
                      {...form.register('email')}
                    />
                  </div>
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={isLoading}
                >
                  {isLoading ? <LoadingSpinner size="sm" /> : 'Enviar Link de Recuperação'}
                </Button>
              </form>

              <div className="text-center text-sm">
                <span className="text-gray-600">Lembrou da senha? </span>
                <Link to={PATHS.LOGIN} className="text-emerald-600 hover:underline font-medium">
                  Fazer Login
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};