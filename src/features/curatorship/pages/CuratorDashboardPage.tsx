import { ShieldCheck } from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';
import { SuggestionsQueue } from '@/features/curatorship/components/SuggestionsQueue';

export const CuratorDashboard = () => {
  return (
    <>
      <PageMetadata
        title="Painel Bibliotecário"
        description="Área exclusiva para membros bibliotecários e administradores da Estante de Bolso."
        noIndex={true}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Painel Bibliotecário</h1>
              <p className="text-sm text-gray-500 mt-1">Gerencie, revise e aprove sugestões de correção enviadas pela comunidade.</p>
            </div>
          </div>
        </div>

        {/* Queue de sugestões */}
        <SuggestionsQueue />
      </main>
    </>
  );
};
