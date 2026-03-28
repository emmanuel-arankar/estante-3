import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';

import { publisherQuery } from '@/features/books/books.queries';
import { updatePublisherAdminAPI } from '@/features/curatorship/services/adminApi';
import { mainPageFadeVariants, SMOOTH_TRANSITION } from '@/lib/animations';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/hooks/useAuth';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { PageMetadata } from '@/common/PageMetadata';

export function AdminEditPublisherPage() {
  const { publisherId } = useParams<{ publisherId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isLibrarian } = useAuth();
  
  const [isSaving, setIsSaving] = useState(false);

  // Redireciona se não autorizado
  useEffect(() => {
    if (!isAdmin && !isLibrarian) {
      navigate('/');
    }
  }, [isAdmin, isLibrarian, navigate]);

  const { data: publisher, isLoading } = useQuery(publisherQuery(publisherId!));

  const [formData, setFormData] = useState({
    name: '',
  });

  useEffect(() => {
    if (publisher) {
      setFormData({
        name: publisher.name || '',
      });
    }
  }, [publisher]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publisher) return;

    setIsSaving(true);
    try {
      const payload: any = {
        name: formData.name,
      };

      await updatePublisherAdminAPI(publisher.id, payload);
      
      toastSuccessClickable('Editora atualizada diretamente.');
      queryClient.invalidateQueries({ queryKey: publisherQuery(publisher.id).queryKey });
      
      // Assumindo que existirá uma rota /publisher/:id ou retornamos para dashboard
      // Neste caso, se houver página de editora, seria /publisher/:id
      // Caso não exista ainda, navega de volta
      navigate(-1);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error || error.message || 'Erro ao atualizar a editora.';
      toastErrorClickable(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !publisher) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageMetadata
        title={`Editar Editora - ${publisher.name} | Estante de Bolso`}
        description="Painel de Administração - Edição Direta de Editoras"
      />
      <motion.div 
        variants={mainPageFadeVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={SMOOTH_TRANSITION}
        className="min-h-screen bg-gray-50 py-8 pb-32"
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header Actions */}
          <div className="mb-6 flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Editar Editora</h1>
              <p className="text-sm text-gray-500">Editando diretamente: <span className="font-semibold text-gray-700">{publisher.name}</span></p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 space-y-8">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700 font-semibold">Nome da Editora <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  required
                  className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Atenção: Mudar o nome da editora afetará todas as páginas que buscam por ela.
                </p>
              </div>
            </div>

            {/* Sticky Footer for Actions */}
            <div className="sticky bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex items-center justify-end gap-3 z-10 transition-all rounded-b-3xl">
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </motion.div>
    </>
  );
}
