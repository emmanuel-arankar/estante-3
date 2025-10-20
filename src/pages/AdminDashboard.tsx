import { ShieldCheck } from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';

export const AdminDashboard = () => {
  return (
    <>
      <PageMetadata
        title="Painel de Administração"
        description="Área de gerenciamento da Estante de Bolso."
        noIndex={true}
      />
      
      <main className="max-w-4xl mx-auto px-4 py-8 text-center">
        <ShieldCheck className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold">Painel de Administração</h1>
        <p className="text-gray-600 mt-2">
          Esta área é restrita e visível apenas para administradores.
        </p>
      </main>
    </>
  );
};
