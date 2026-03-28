import { PageMetadata } from '@/common/PageMetadata';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const ForgotPassword = () => {
  return (
    <>
      <PageMetadata
        title="Recuperar Senha"
        description="Esqueceu sua senha? Recupere seu acesso à sua conta da Estante de Bolso."
        noIndex={true}
      />
      <ForgotPasswordForm />
    </>
  );
};
