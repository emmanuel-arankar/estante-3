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
      <LoginForm />
    </>
  );
};