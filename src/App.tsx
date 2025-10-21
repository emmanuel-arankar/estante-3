import { RouterProvider } from 'react-router-dom';
import { appRouter } from '@/router';
import { useAuth } from '@/hooks/useAuth';
import { useManageMyPresence } from '@/hooks/useUserPresence';

function App() {
  // Inicializa o listener de autenticação e atualiza o store
  useAuth(); 
  // Lê o user do store (via useAuth interno) e gerencia a presença
  useManageMyPresence(); 

  return <RouterProvider router={appRouter} />;
}

export default App;