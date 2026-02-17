import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
    freezeOnceVisible?: boolean;
}

/**
 * Hook para detectar quando elemento entra no viewport
 * Útil para lazy loading avançado com controle total
 */
export function useIntersectionObserver(
    options: UseIntersectionObserverOptions = {}
): [React.RefObject<HTMLDivElement>, boolean] {
    const {
        threshold = 0,
        root = null,
        rootMargin = '200px', // Pré-carrega 200px antes
        freezeOnceVisible = true
    } = options;

    const elementRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        // Se já está visível e freeze está ativo, não fazer nada
        if (freezeOnceVisible && isVisible) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { threshold, root, rootMargin }
        );

        observer.observe(element);

        return () => {
            if (element) {
                observer.unobserve(element);
            }
        };
    }, [threshold, root, rootMargin, freezeOnceVisible, isVisible]);

    return [elementRef, isVisible];
}
