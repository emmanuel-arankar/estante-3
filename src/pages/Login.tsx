import { BookOpen } from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';
import { LoginForm } from '@/components/auth/LoginForm';

export const Login = () => {
  return (
    <>
      <PageMetadata
        title="Entrar"
        description="Acesse sua conta na Estante de Bolso para continuar compartilhando e descobrindo novas leituras."
        ogTitle="Entrar na Estante de Bolso"
        noIndex={true}
      />

      <main className="relative min-h-[calc(100vh-80px)] bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4 w-full overflow-x-hidden">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left side - Branding */}
          <div className="hidden lg:flex flex-col items-center justify-center text-center space-y-6">
            <div className="flex flex-column items-center space-x-3">
              <div className="bg-emerald-600 p-4 rounded-2xl">
                <BookOpen className="h-12 w-12 text-white" />
              </div>
              <div className="flex flex-col text-left justify-center">
                <span className="text-3xl font-bold text-emerald-700 font-sans">Estante de Bolso</span>
                <p className="text-xl text-gray-500 hidden sm:block font-sans">Toda literatura na palma da sua mão</p>
              </div>
            </div>
            <p className="text-xl text-gray-600 max-w-md">
              Conecte-se com outros leitores e descubra seu próximo livro favorito
            </p>
          </div>

          {/* Right side - Login Form */}
          <div className="flex justify-center">
            <LoginForm />
          </div>
        </div>
      </main>
    </>
  );
};