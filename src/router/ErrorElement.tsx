import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PATHS } from './paths';

export function ErrorElement() {
  const error = useRouteError();
  let title = 'Ocorreu um erro!';
  let message = 'Houve um problema inesperado. Por favor, tente novamente mais tarde.';

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Página não encontrada';
      message = 'A página que você está procurando não existe ou foi movida.';
    } else if (error.statusText) {
      title = error.statusText;
      message = error.data?.message || 'Não foi possível carregar os dados para esta página.';
    }
  }

  console.error('Route Error Boundary:', error);

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
      <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
      <p className="text-gray-600 mb-6 max-w-md">{message}</p>
      <Button asChild variant="outline">
        <Link to={PATHS.HOME}>
          <Home className="h-4 w-4 mr-2" />
          Voltar para o Início
        </Link>
      </Button>
    </div>
  );
}
