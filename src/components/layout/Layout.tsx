import { useState, useEffect, useMemo } from 'react'; // # atualizado
import { Header } from './Header';
import { Footer } from './Footer';
import { Toaster } from 'react-hot-toast';
import { Outlet, useLoaderData, useLocation, useMatches, useNavigation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { mainPageFadeVariants, MAIN_PAGE_TRANSITION } from '../../lib/animations';
import { PATHS } from '@/router/paths';
import { FocusManager } from '@/router/FocusManager';
import { toastSuccessClickable } from '../ui/toast';
import { User } from '@/models';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '../ui/loading-spinner';

interface LayoutData {
  userProfile: User | null;
  initialFriendRequests: number;
}

const usePageTitle = () => {
  const matches = useMatches();

  useEffect(() => {
    const lastMatchWithTitle = [...matches].reverse().find(
      (match) => match.handle && typeof (match.handle as any).title === 'function'
    );

    if (lastMatchWithTitle) {
      const handle = lastMatchWithTitle.handle as any;
      document.title = handle.title(lastMatchWithTitle.data);
    } else {
      document.title = 'Estante de Bolso - Sua rede social de leitura';
    }
  }, [matches]);
};

export const Layout = () => {
  const loaderData = useLoaderData() as LayoutData;
  const location = useLocation();
  const navigation = useNavigation();
  const matches = useMatches(); // # atualizado
  const isLoading = navigation.state === 'loading';

  const authUser = useAuthStore((state) => state.user);
  const isLoadingProfile = useAuthStore((state) => state.isLoadingProfile);
  const loadingMessage = useAuthStore((state) => state.loadingMessage);
  
  const [headerData, setHeaderData] = useState(loaderData);

  usePageTitle();

  // # atualizado: Chave de animação inteligente que ignora sub-rotas (abas).
  const pageKey = useMemo(() => {
    const routeMatch = [...matches]
      .reverse()
      .find((match) => {
        // # atualizado: Verificação de tipo para garantir que 'handle' é um objeto e possui 'id'.
        const handle = match.handle as { id?: string };
        return handle?.id !== undefined;
      });
  
    if (routeMatch) {
      // # atualizado: Acesso seguro à propriedade 'id' após a verificação.
      return (routeMatch.handle as { id: string }).id;
    }
  
    // Fallback para o pathname se nenhum ID de rota for encontrado.
    return location.pathname + location.search;
  }, [matches, location]);

  useEffect(() => {
    if (navigation.state === 'idle') {
      setHeaderData(loaderData);
    }
  }, [navigation.state, loaderData]);

  useEffect(() => {
    const toastMessage = sessionStorage.getItem('showLoginSuccessToast');
    if (toastMessage) {
      toastSuccessClickable(toastMessage);
      sessionStorage.removeItem('showLoginSuccessToast');
    }
  }, [location]);

  // # atualizado: Lógica para garantir que o perfil seja nulo se o usuário da store for nulo.
  const effectiveProfile = authUser ? headerData.userProfile : null;
  const effectiveFriendRequests = authUser ? headerData.initialFriendRequests : 0;

  const noFooterPaths = [PATHS.LOGIN, PATHS.REGISTER, PATHS.FORGOT_PASSWORD];
  const shouldShowFooter = !noFooterPaths.includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 w-full overflow-x-hidden">
      <FocusManager />
      
      <div
        className={`fixed top-0 left-0 right-0 h-1 bg-emerald-500 z-[99] transition-transform duration-300 ${
          isLoading ? 'scale-x-100' : 'scale-x-0'
        }`}
        style={{ transformOrigin: 'left' }}
      />

      <AnimatePresence>
        {isLoadingProfile && (
          <motion.div
            key="loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[98] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
          >
            <LoadingSpinner size="lg" className="text-emerald-600" />
            <p className="mt-4 text-lg font-medium text-gray-700">{loadingMessage || 'Carregando...'}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <Header
        userProfile={effectiveProfile} // # atualizado
        initialFriendRequests={effectiveFriendRequests} // # atualizado
      />

      <main className="flex-1 w-full pt-20 grid relative">
        {/* # atualizado: Removido mode="wait" para permitir a sobreposição (cross-fade) */}
        <AnimatePresence initial={false}>
          <motion.div
            key={pageKey}
            variants={mainPageFadeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={MAIN_PAGE_TRANSITION}
            // # atualizado: Garante que a página que entra e a que sai ocupem o mesmo espaço.
            style={{ gridArea: "1 / 1" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {shouldShowFooter && <Footer />}
      <Toaster
        position="top-right"
        containerStyle={{ top: '88px' }}
        gutter={8}
      />
    </div>
  );
};