import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';

import { editionQuery } from '@/features/books/books.queries';
import { updateEditionAdminAPI } from '@/features/curatorship/services/adminApi';
import { mainPageFadeVariants, SMOOTH_TRANSITION } from '@/lib/animations';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/hooks/useAuth';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { PageMetadata } from '@/common/PageMetadata';

export function AdminEditEditionPage() {
  const { editionId } = useParams<{ editionId: string }>();
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

  const { data: edition, isLoading } = useQuery(editionQuery(editionId!));

  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    isbn13: '',
    isbn10: '',
    asin: '',
    pages: '',
    formatId: '',
    language: '',
    publicationDate: '',
    coverUrl: '',
    editionNumber: '',
  });

  useEffect(() => {
    if (edition) {
      setFormData({
        title: edition.title || '',
        subtitle: edition.subtitle || '',
        description: edition.description || '',
        isbn13: edition.isbn13 || '',
        isbn10: edition.isbn10 || '',
        asin: edition.asin || '',
        pages: edition.pages?.toString() || '',
        formatId: edition.formatId || '',
        language: edition.language || '',
        publicationDate: edition.publicationDate || '',
        coverUrl: edition.coverUrl || '',
        editionNumber: edition.editionNumber?.toString() || '',
      });
    }
  }, [edition]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edition) return;

    setIsSaving(true);
    try {
      const payload: any = {
        title: formData.title,
      };

      if (formData.subtitle) payload.subtitle = formData.subtitle;
      if (formData.description) payload.description = formData.description;
      if (formData.isbn13) payload.isbn13 = formData.isbn13;
      if (formData.isbn10) payload.isbn10 = formData.isbn10;
      if (formData.asin) payload.asin = formData.asin;
      if (formData.formatId) payload.formatId = formData.formatId;
      if (formData.language) payload.language = formData.language;
      if (formData.publicationDate) payload.publicationDate = formData.publicationDate;
      if (formData.coverUrl) payload.coverUrl = formData.coverUrl;
      
      if (formData.pages) {
        const p = parseInt(formData.pages, 10);
        if (!isNaN(p)) payload.pages = p;
      }
      if (formData.editionNumber) {
        const en = parseInt(formData.editionNumber, 10);
        if (!isNaN(en)) payload.editionNumber = en;
      }

      await updateEditionAdminAPI(edition.id, payload);
      
      toastSuccessClickable('Edição atualizada diretamente.');
      queryClient.invalidateQueries({ queryKey: editionQuery(edition.id).queryKey });
      
      navigate(`/book/${edition.id}`);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error || error.message || 'Erro ao atualizar a edição.';
      toastErrorClickable(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !edition) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageMetadata
        title={`Editar Edição - ${edition.title} | Estante de Bolso`}
        description="Painel de Administração - Edição Direta de Edições"
      />
      <motion.div 
        variants={mainPageFadeVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={SMOOTH_TRANSITION}
        className="min-h-screen bg-gray-50 py-8 pb-32"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
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
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Editar Edição</h1>
              <p className="text-sm text-gray-500">Editando diretamente: <span className="font-semibold text-gray-700">{edition.title}</span></p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 space-y-8">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-gray-700 font-semibold">Título da Edição <span className="text-red-500">*</span></Label>
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
                  <Label htmlFor="subtitle" className="text-gray-700 font-medium">Subtítulo</Label>
                  <Input
                    id="subtitle"
                    value={formData.subtitle}
                    onChange={(e) => setFormData(p => ({ ...p, subtitle: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formatId" className="text-gray-700 font-medium">Formato (ID) - Ex: hardcover, paperback</Label>
                  <Input
                    id="formatId"
                    value={formData.formatId}
                    onChange={(e) => setFormData(p => ({ ...p, formatId: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="isbn13" className="text-gray-700 font-medium">ISBN-13</Label>
                  <Input
                    id="isbn13"
                    value={formData.isbn13}
                    onChange={(e) => setFormData(p => ({ ...p, isbn13: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="isbn10" className="text-gray-700 font-medium">ISBN-10</Label>
                  <Input
                    id="isbn10"
                    value={formData.isbn10}
                    onChange={(e) => setFormData(p => ({ ...p, isbn10: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asin" className="text-gray-700 font-medium">ASIN</Label>
                  <Input
                    id="asin"
                    value={formData.asin}
                    onChange={(e) => setFormData(p => ({ ...p, asin: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="pages" className="text-gray-700 font-medium">Páginas</Label>
                  <Input
                    id="pages"
                    type="number"
                    value={formData.pages}
                    onChange={(e) => setFormData(p => ({ ...p, pages: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editionNumber" className="text-gray-700 font-medium">Número da Edição</Label>
                  <Input
                    id="editionNumber"
                    type="number"
                    value={formData.editionNumber}
                    onChange={(e) => setFormData(p => ({ ...p, editionNumber: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publicationDate" className="text-gray-700 font-medium">Data Publicação</Label>
                  <Input
                    id="publicationDate"
                    type="date"
                    value={formData.publicationDate}
                    onChange={(e) => setFormData(p => ({ ...p, publicationDate: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language" className="text-gray-700 font-medium">Idioma (Código ISO)</Label>
                <Input
                  id="language"
                  value={formData.language}
                  onChange={(e) => setFormData(p => ({ ...p, language: e.target.value }))}
                  placeholder="Ex: pt, en, ja"
                  className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coverUrl" className="text-gray-700 font-medium">URL da Capa</Label>
                <Input
                  id="coverUrl"
                  type="url"
                  value={formData.coverUrl}
                  onChange={(e) => setFormData(p => ({ ...p, coverUrl: e.target.value }))}
                  className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-700 font-medium">Sinopse da Edição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="min-h-[200px] resize-y bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
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
                className="px-6 py-2.5 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
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
