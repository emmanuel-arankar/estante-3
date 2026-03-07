import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { Outlet, useLoaderData, useLocation, useMatches, useNavigation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toastSuccessClickable } from '@/components/ui/toast';
import { mainPageFadeVariants, MAIN_PAGE_TRANSITION } from '@/lib/animations';
import { PATHS } from '@/router/paths';
import { FocusManager } from '@/router/FocusManager';
import { useAuthStore } from '@/stores/authStore';
import { User } from '@estante/common-types';
import { ArrowUp } from 'lucide-react';
import { AnalyticsRouteTracker } from '@/components/AnalyticsRouteTracker';

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
  const matches = useMatches();
  const isLoading = navigation.state === 'loading';

  const authUser = useAuthStore((state) => state.user);
  const storedUserProfile = useAuthStore((state) => state.userProfile);
  const isLoadingProfile = useAuthStore((state) => state.isLoadingProfile);
  const authLoading = useAuthStore((state) => state.loading); // Loading inicial do Firebase
  const loadingMessage = useAuthStore((state) => state.loadingMessage);

  const [headerData, setHeaderData] = useState(loaderData);

  usePageTitle();

  // Limpa headerData quando o usuário muda ou desloga
  // Isso evita que dados do usuário anterior apareçam para o novo usuário
  useEffect(() => {
    if (!authUser) {
      setHeaderData({ userProfile: null, initialFriendRequests: 0 });
    }
  }, [authUser?.uid]);

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pageKey = useMemo(() => {
    const routeMatch = [...matches]
      .reverse()
      .find((match) => {
        const handle = match.handle as { id?: string };
        return handle?.id !== undefined;
      });

    if (routeMatch) {
      return (routeMatch.handle as { id: string }).id;
    }
    return location.pathname + location.search;
  }, [matches, location]);

  useEffect(() => {
    if (navigation.state === 'idle') {
      setHeaderData(loaderData);

      // Resetar loading de perfil quando a navegação terminar
      // Importante: Resetamos mesmo se userProfile for null para não travar a UI
      if (isLoadingProfile) {
        useAuthStore.getState().setIsLoadingProfile(false);
      }
    }
  }, [navigation.state, loaderData, isLoadingProfile]);

  useEffect(() => {
    const toastMessage = sessionStorage.getItem('showLoginSuccessToast');
    if (toastMessage) {
      toastSuccessClickable(toastMessage);
      sessionStorage.removeItem('showLoginSuccessToast');
    }
  }, [location.pathname]);

  // Se estamos carregando auth ou perfil EXPLICITAMENTE, mostrar estado de loading
  // Mas com um limite de sanidade (se passar de 4s, libera)
  const [showLoadingSanity, setShowLoadingSanity] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoadingSanity(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const showAuthLoading = (authLoading || isLoadingProfile) && showLoadingSanity;

  // Construir perfil efetivo com estratégia de fallback (Optimistic UI)
  // CRITICAL: Se não há authUser, o perfil DEVE ser nulo para evitar dados fantasmas no Header
  // PRIORITY: storedUserProfile (Zustand) > headerData.userProfile (loader) para reflexão em tempo real
  let effectiveProfile = authUser ? (storedUserProfile || headerData.userProfile) : null;

  //console.log('🟢 [Layout] Render with:', {
  //  hasAuthUser: !!authUser,
  //  storedPhotoURL: storedUserProfile?.photoURL,
  //  headerPhotoURL: headerData.userProfile?.photoURL,
  //  effectivePhotoURL: effectiveProfile?.photoURL
  //});

  if (authUser && !effectiveProfile) {
    // Perfil temporário para exibição imediata (apenas se estiver logado)
    effectiveProfile = {
      id: authUser.uid,
      displayName: authUser.displayName || 'Usuário',
      email: authUser.email || '',
      photoURL: authUser.photoURL || '',
      nickname: '', // Será tratado no componente
      bio: '',
      location: '',
      website: '',
      role: 'user',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      booksRead: 0,
      currentlyReading: 0,
      followers: 0,
      following: 0,
    } as User;
  }

  const effectiveFriendRequests = authUser ? headerData.initialFriendRequests : 0;

  const noFooterPaths = [PATHS.LOGIN, PATHS.REGISTER, PATHS.FORGOT_PASSWORD, PATHS.MESSAGES];
  const shouldShowFooter = !noFooterPaths.includes(location.pathname) && !location.pathname.startsWith('/chat');

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 w-full overflow-x-hidden">
      <AnalyticsRouteTracker />
      <FocusManager />

      <div
        className={`fixed top-0 left-0 right-0 h-1 bg-emerald-500 z-[99] transition-transform duration-300 ${isLoading ? 'scale-x-100' : 'scale-x-0'}`}
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
        userProfile={effectiveProfile}
        initialFriendRequests={effectiveFriendRequests}
        isAuthenticated={!!authUser}
        isAuthLoading={showAuthLoading}
      />

      <main className="flex-1 w-full pt-20 grid relative">
        <AnimatePresence initial={false}>
          <motion.div
            key={pageKey}
            variants={mainPageFadeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={MAIN_PAGE_TRANSITION}
            style={{ gridArea: "1 / 1" } as CSSProperties}
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

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 hover:-translate-y-1 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label="Voltar ao topo"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};