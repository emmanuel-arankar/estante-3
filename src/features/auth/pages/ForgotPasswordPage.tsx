import { PageMetadata } from '@/common/PageMetadata';
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

export const ForgotPasswordPage = () => {
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
