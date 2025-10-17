import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PATHS } from '@/router/paths';
import { PageMetadata } from '@/common/PageMetadata';

export const NotFound = () => {
  return (
    <>
      <PageMetadata
        title="Página Não Encontrada"
        description="O conteúdo que você procurava não foi encontrado ou foi movido."
        noIndex={true}
      />
      
      <main className="flex flex-col items-center justify-center h-screen bg-gray-100 text-center">
        <h1 className="text-6xl font-bold text-emerald-600">404</h1>
        <p className="text-xl mt-4 mb-2 text-gray-800">Página Não Encontrada</p>
        <p className="text-gray-600 mb-6">
          A página que você está procurando não existe ou foi movida.
        </p>
        <Button asChild>
          <Link to={PATHS.HOME}>Voltar para a Home</Link>
        </Button>
      </main>
    </>
  );
};