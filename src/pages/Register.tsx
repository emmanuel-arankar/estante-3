import { useState } from 'react';
import { Form, Link, useNavigation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
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
import { PATHS } from '@/router/paths';
import { PageMetadata } from '@/common/PageMetadata';

export const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <>
      <PageMetadata
        title="Crie sua Conta"
        description="Junte-se à comunidade de leitores Estante de Bolso. Crie sua conta gratuitamente e comece a compartilhar suas paixões literárias."
        ogTitle="Crie sua Conta na Estante de Bolso"
        ogDescription="Junte-se à nossa comunidade de leitores e amantes de livros."
        noIndex={true}
      />
      
      <main className="relative min-h-[calc(100vh-80px)] bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4 w-full overflow-x-hidden">
        <div className="w-full max-w-md">
          <Card className="w-full shadow-lg border-0">
            <CardHeader className="space-y-1 text-center">
              <CardTitle as="h1" className="text-2xl text-center font-sans">
                Criar Conta
              </CardTitle>
              <CardDescription className="text-gray-600">
                Junte-se à nossa comunidade de leitores
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
                      placeholder="Seu nome"
                      className="pl-10 bg-gray-50 border-gray-200 focus:bg-white"
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
                      placeholder="Seu email"
                      className="pl-10 bg-gray-50 border-gray-200 focus:bg-white"
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
                      className="pl-10 pr-10 bg-gray-50 border-gray-200 focus:bg-white"
                      required
                      minLength={6}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-md" disabled={isSubmitting}>
                  {isSubmitting ? <LoadingSpinner size="sm" /> : 'Cadastrar'}
                </Button>
              </Form>

              <div className="text-center text-sm mt-4">
                <span className="text-gray-600">Já tem uma conta? </span>
                <Link to={PATHS.LOGIN} className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline">
                  Faça login
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};