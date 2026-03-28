import { PageMetadata } from '@/common/PageMetadata';
import { RegisterForm } from '@/components/auth/RegisterForm';

export const Register = () => {
  return (
    <>
      <PageMetadata
        title="Crie sua Conta"
        description="Junte-se à comunidade de leitores Estante de Bolso. Crie sua conta gratuitamente e comece a compartilhar suas paixões literárias."
        ogTitle="Crie sua Conta na Estante de Bolso"
        ogDescription="Junte-se à nossa comunidade de leitores e amantes de livros."
        noIndex={true}
      />
      <RegisterForm />
    </>
  );
};
