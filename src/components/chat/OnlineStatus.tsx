// src/components/chat/OnlineStatus.tsx (Versão para Teste)
import { cn } from '@/lib/utils';
import { useUserPresence } from "@/hooks/useUserPresence";

interface OnlineStatusProps {
  userId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const OnlineStatus = ({ userId, className, size = 'sm' }: OnlineStatusProps) => {
  const { online } = useUserPresence(userId);
  console.log(`[OnlineStatus] Re-rendering for userId: ${userId}, online: ${online}`); // Manter log

  const sizePixels = { sm: '12px', md: '16px', lg: '20px' };

  return (
    <div
      style={{
        height: sizePixels[size],
        width: sizePixels[size],
        borderRadius: '50%',
        border: '2px solid white',
        // Usar cores explícitas aqui
        backgroundColor: online ? '#22c55e' : '#9ca3af', // Verde vs Cinza
        // Adicionar !important pode ajudar a identificar conflitos, mas não é solução final
        // backgroundColor: online ? '#22c55e !important' : '#9ca3af !important',
      }}
      className={className} // Manter className para posicionamento
      title={online ? "Online" : "Offline"}
    />
  );
};