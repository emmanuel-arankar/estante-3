import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function PWAUpdatePrompt() {
    const {
        needRefresh,
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('[PWA] Service Worker registered:', r);
        },
        onRegisterError(error) {
            console.error('[PWA] Service Worker registration error:', error);
        },
    });

    const handleUpdate = () => {
        updateServiceWorker(true);
    };

    if (!needRefresh) return null;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white rounded-lg shadow-lg p-4 z-50 max-w-md">
            <div className="flex items-center space-x-3">
                <RefreshCw className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Nova versão disponível!</p>
                    <p className="text-xs text-blue-100">Atualize para obter as últimas melhorias</p>
                </div>
                <Button
                    onClick={handleUpdate}
                    size="sm"
                    className="bg-white text-blue-600 hover:bg-blue-50 flex-shrink-0"
                >
                    Atualizar
                </Button>
            </div>
        </div>
    );
}
