import { useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { BookOpen } from 'lucide-react';

const authTransitionVariants = {
    initial: (direction: number) => ({
        opacity: 0,
        x: direction > 0 ? 100 : -100,
        filter: 'blur(8px)',
        pointerEvents: 'none' as const, // Evita cliques em elementos entrando antes do tempo
    }),
    animate: {
        opacity: 1,
        x: 0,
        filter: 'blur(0px)',
        pointerEvents: 'auto' as const,
    },
    exit: (direction: number) => ({
        opacity: 0,
        x: direction > 0 ? -100 : 100,
        filter: 'blur(8px)',
        position: 'absolute' as const,
        pointerEvents: 'none' as const, // CRITICAL: Impede que o formulário saindo bloqueie o novo
        zIndex: 0,
    }),
};

const AUTH_TRANSITION: Transition = {
    duration: 0.5, // Leve redução de 0.6 para 0.5 para melhorar a responsividade sem perder a elegância
    ease: [0.22, 1, 0.36, 1],
};

export const AuthLayout = () => {
    const location = useLocation();

    // Lógica Hub-and-Spoke Determinística:
    // Se o destino é o LOGIN, estamos sempre "voltando" (direção -1).
    // Se o destino é qualquer outra página, estamos sempre "avançando" (direção 1).
    // Isso é imune a bugs de cliques rápidos pois não depende do estado anterior instável.
    const direction = location.pathname.includes('login') ? -1 : 1;

    return (
        <main className="relative min-h-[calc(100vh-80px)] bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4 w-full overflow-x-hidden">
            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-transparent">
                {/* Left side - Branding (Static) */}
                <div className="hidden lg:flex flex-col items-center justify-center text-center space-y-6 select-none">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="bg-emerald-600 p-6 rounded-3xl shadow-lg">
                            <BookOpen className="h-16 w-16 text-white" />
                        </div>
                        <div className="flex flex-col text-center justify-center">
                            <span className="text-4xl font-bold text-emerald-800 font-sans tracking-tight">Estante de Bolso</span>
                            <p className="text-xl text-emerald-600/80 mt-2 font-sans font-medium">Sua jornada literária começa aqui</p>
                        </div>
                    </div>
                    <p className="text-lg text-gray-600 max-w-md font-sans leading-relaxed">
                        Conecte-se com outros leitores. Descubra seu próximo livro favorito e compartilhe suas avaliações com o mundo.
                    </p>
                </div>

                {/* Right side - Form Transition */}
                <div className="flex justify-center relative py-4 min-h-[550px] items-center">
                    <AnimatePresence mode="popLayout" custom={direction} initial={false}>
                        <motion.div
                            key={location.pathname}
                            custom={direction}
                            variants={authTransitionVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            transition={AUTH_TRANSITION}
                            className="w-full flex justify-center z-10"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </main>
    );
};
