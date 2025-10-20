import { RouterProvider } from 'react-router-dom';
import { appRouter } from './router';
import { useAuth } from './hooks/useAuth';

function App() {
  // O hook useAuth é chamado aqui para iniciar a verificação de auth.
  // A lógica de carregamento será movida para o Layout.
  useAuth();

  // O RouterProvider foi movido para main.tsx.
  // O componente App agora pode ser simplificado ou removido,
  // mas por enquanto vamos mantê-lo para conter a lógica do useAuth.
  // A renderização real acontecerá através da configuração do router.
  return <RouterProvider router={appRouter} />;
}

export default App;