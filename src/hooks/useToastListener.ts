import { useEffect } from 'react';

export const useToastListener = (message: string, callback: () => void) => {
  useEffect(() => {
    const checkToast = setInterval(() => {
      const toasts = document.querySelectorAll('[data-toast]');
      toasts.forEach(toastElement => {
        const toastText = toastElement.textContent;
        if (toastText && toastText.includes(message)) {
          callback();
          clearInterval(checkToast);
        }
      });
    }, 100);

    return () => clearInterval(checkToast);
  }, [message, callback]);
};