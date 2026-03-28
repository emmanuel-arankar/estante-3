import { useState } from 'react';
import { ShieldCheck, Clock, History } from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';
import { SuggestionsQueue } from '@/features/curatorship/components/SuggestionsQueue';
import { DecisionHistory } from '@/features/curatorship/components/DecisionHistory';
import { CuratorStats } from '@/features/curatorship/components/CuratorStats';

type Tab = 'pending' | 'history';

export const CuratorDashboardPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>('pending');

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

        {/* Cards de Estatísticas */}
        <CuratorStats />

        {/* Abas de navegação */}
        <div className="flex gap-1 p-1 bg-gray-100/70 rounded-xl mb-6 w-fit">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === 'pending'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pendentes
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === 'history'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-4 h-4" />
            Histórico
          </button>
        </div>

        {/* Conteúdo da aba */}
        {activeTab === 'pending' ? <SuggestionsQueue /> : <DecisionHistory />}
      </main>
    </>
  );
};
