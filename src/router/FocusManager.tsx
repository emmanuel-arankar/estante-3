import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export const FocusManager = () => {
  const location = useLocation();
  // # atualizado: renomeado para refletir o novo alvo
  const focusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      // # atualizado: o alvo agora é o elemento <main>
      const mainContent = document.querySelector('main');
      if (mainContent) {
        // # atualizado: Foca o container principal do conteúdo
        mainContent.setAttribute('tabindex', '-1');
        mainContent.focus();
        focusedElementRef.current = mainContent;
      }
    }, 100); // # atualizado: Aumentado o tempo para garantir a renderização

    return () => {
      clearTimeout(timer);
      // # atualizado: Limpa o tabindex do elemento focado anteriormente
      if (focusedElementRef.current) {
        focusedElementRef.current.removeAttribute('tabindex');
      }
    };
  }, [location.pathname]);

  const handleSkipToContent = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const mainContent = document.querySelector('main');
    if (mainContent) {
      const firstFocusableElement = mainContent.querySelector<HTMLElement>(
        'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusableElement) {
        firstFocusableElement.focus();
      } else {
        // # atualizado: Fallback para focar no próprio main se não houver interativos
        mainContent.setAttribute('tabindex', '-1');
        mainContent.focus();
      }
    }
  };

  return (
    <a
      href="#main-content"
      onClick={handleSkipToContent}
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:border focus:rounded-md"
    >
      Pular para o conteúdo
    </a>
  );
};