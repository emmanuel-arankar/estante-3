import { createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';

/**
 * # atualizado: O arquivo index agora apenas cria o roteador.
 * Toda a lógica de estrutura e importação de rotas foi movida para `routes.tsx`,
 * tornando este arquivo mais enxuto e focado em sua única responsabilidade.
 */
export const appRouter = createBrowserRouter(routes);