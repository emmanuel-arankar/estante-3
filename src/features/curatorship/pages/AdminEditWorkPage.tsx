import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';

import { workQuery } from '@/features/books/books.queries';
import { updateWorkAdminAPI } from '@/features/curatorship/services/adminApi';
import { mainPageFadeVariants, SMOOTH_TRANSITION } from '@/lib/animations';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/hooks/useAuth';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { PageMetadata } from '@/common/PageMetadata';

export function AdminEditWorkPage() {
  const { workId } = useParams<{ workId: string }>();
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

  const { data: work, isLoading } = useQuery(workQuery(workId!));

  const [formData, setFormData] = useState({
    title: '',
    originalTitle: '',
    originalPublicationDate: '',
    originalLanguage: '',
    description: '',
  });

  useEffect(() => {
    if (work) {
      setFormData({
        title: work.title || '',
        originalTitle: work.originalTitle || '',
        originalPublicationDate: work.originalPublicationDate || '',
        originalLanguage: work.originalLanguage || '',
        description: work.description || '',
      });
    }
  }, [work]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!work) return;

    setIsSaving(true);
    try {
      const payload: any = {
        title: formData.title,
        description: formData.description,
      };

      if (formData.originalTitle) payload.originalTitle = formData.originalTitle;
      if (formData.originalPublicationDate) payload.originalPublicationDate = formData.originalPublicationDate;
      if (formData.originalLanguage) payload.originalLanguage = formData.originalLanguage;

      await updateWorkAdminAPI(work.id, payload);
      
      toastSuccessClickable('Obra atualizada diretamente.');
      queryClient.invalidateQueries({ queryKey: workQuery(work.id).queryKey });
      
      navigate(`/work/${work.id}`);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error || error.message || 'Erro ao atualizar a obra.';
      toastErrorClickable(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !work) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageMetadata
        title={`Editar Obra - ${work.title} | Estante de Bolso`}
        description="Painel de Administração - Edição Direta de Obras"
      />
      <motion.div 
        variants={mainPageFadeVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={SMOOTH_TRANSITION}
        className="min-h-screen bg-gray-50 py-8 pb-32"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          
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
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Editar Obra</h1>
              <p className="text-sm text-gray-500">Editando diretamente: <span className="font-semibold text-gray-700">{work.title}</span></p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 space-y-8">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-gray-700 font-semibold">Título da Obra <span className="text-red-500">*</span></Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  required
                  className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="originalTitle" className="text-gray-700 font-medium">Título Original</Label>
                  <Input
                    id="originalTitle"
                    value={formData.originalTitle}
                    onChange={(e) => setFormData(p => ({ ...p, originalTitle: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="originalPublicationDate" className="text-gray-700 font-medium">Data Publicação Original</Label>
                  <Input
                    id="originalPublicationDate"
                    type="date"
                    value={formData.originalPublicationDate}
                    onChange={(e) => setFormData(p => ({ ...p, originalPublicationDate: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="originalLanguage" className="text-gray-700 font-medium">Idioma Original (Código ISO)</Label>
                <Input
                  id="originalLanguage"
                  value={formData.originalLanguage}
                  onChange={(e) => setFormData(p => ({ ...p, originalLanguage: e.target.value }))}
                  placeholder="Ex: en, pt, ja"
                  className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-700 font-medium">Sinopse da Obra</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="min-h-[200px] resize-y bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  placeholder="Ex: Harry Potter é um garoto órfão..."
                />
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
