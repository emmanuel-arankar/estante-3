import { useState } from 'react';
import { X, Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';

export function PWAInstallBanner() {
    const { isInstallable, isInstalled, install } = usePWAInstall();
    const [dismissed, setDismissed] = useState(false);

    // Não mostrar se já instalado ou foi dispensado
    if (isInstalled || dismissed || !isInstallable) {
        return null;
    }

    const handleInstall = async () => {
        const success = await install();
        if (success) {
            setDismissed(true);
        }
    };

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-emerald-600 text-white rounded-lg shadow-lg p-4 z-50">
            <button
                onClick={() => setDismissed(true)}
                className="absolute top-2 right-2 p-1 hover:bg-emerald-700 rounded transition"
                aria-label="Fechar"
            >
                <X className="h-4 w-4" />
            </button>

            <div className="flex items-start space-x-3">
                <div className="bg-white p-2 rounded flex-shrink-0">
                    <Download className="h-6 w-6 text-emerald-600" />
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1">Instalar Estante de Bolso</h3>
                    <p className="text-sm text-emerald-50 mb-3">
                        Acesse mais rápido e use offline instalando o app
                    </p>

                    <div className="flex space-x-2">
                        <Button
                            onClick={handleInstall}
                            className="bg-white text-emerald-600 hover:bg-emerald-50"
                            size="sm"
                        >
                            Instalar
                        </Button>
                        <Button
                            onClick={() => setDismissed(true)}
                            variant="ghost"
                            className="text-white hover:bg-emerald-700"
                            size="sm"
                        >
                            Agora não
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
