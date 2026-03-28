import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';

import { authorQuery } from '@/features/books/books.queries';
import { updatePersonAdminAPI } from '@/features/curatorship/services/adminApi';
import { mainPageFadeVariants, SMOOTH_TRANSITION } from '@/lib/animations';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/hooks/useAuth';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { PageMetadata } from '@/common/PageMetadata';

export function AdminEditPersonPage() {
  const { personId } = useParams<{ personId: string }>();
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

  const { data: person, isLoading } = useQuery(authorQuery(personId!));

  const [formData, setFormData] = useState({
    name: '',
    birthDate: '',
    deathDate: '',
    nationality: '',
    bio: '',
    photoUrl: '',
    website: '',
  });

  useEffect(() => {
    if (person) {
      setFormData({
        name: person.name || '',
        birthDate: person.birthDate || '',
        deathDate: person.deathDate || '',
        nationality: person.nationality || '',
        bio: person.bio || '',
        photoUrl: person.photoUrl || '',
        website: person.website || '',
      });
    }
  }, [person]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!person) return;

    setIsSaving(true);
    try {
      const payload: any = {
        name: formData.name,
      };

      if (formData.birthDate) payload.birthDate = formData.birthDate;
      if (formData.deathDate) payload.deathDate = formData.deathDate;
      if (formData.nationality) payload.nationality = formData.nationality;
      if (formData.bio) payload.bio = formData.bio;
      if (formData.photoUrl) payload.photoUrl = formData.photoUrl;
      if (formData.website) payload.website = formData.website;

      await updatePersonAdminAPI(person.id, payload);

      toastSuccessClickable('Perfil de autor atualizado diretamente.');
      queryClient.invalidateQueries({ queryKey: authorQuery(person.id).queryKey });

      navigate(`/author/${person.id}`);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error || error.message || 'Erro ao atualizar o autor.';
      toastErrorClickable(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !person) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageMetadata
        title={`Editar Autor - ${person.name} | Estante de Bolso`}
        description="Painel de Administração - Edição Direta de Autor"
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
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Editar Autor</h1>
              <p className="text-sm text-gray-500">Editando diretamente: <span className="font-semibold text-gray-700">{person.name}</span></p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 space-y-8">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700 font-semibold">Nome do Autor <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  required
                  className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="birthDate" className="text-gray-700 font-medium">Data de Nascimento</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData(p => ({ ...p, birthDate: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deathDate" className="text-gray-700 font-medium">Data de Falecimento (Opcional)</Label>
                  <Input
                    id="deathDate"
                    type="date"
                    value={formData.deathDate}
                    onChange={(e) => setFormData(p => ({ ...p, deathDate: e.target.value }))}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationality" className="text-gray-700 font-medium">Nacionalidade (Código ISO)</Label>
                <Input
                  id="nationality"
                  value={formData.nationality}
                  onChange={(e) => setFormData(p => ({ ...p, nationality: e.target.value }))}
                  placeholder="Ex: en, pt, ja"
                  className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="photoUrl" className="text-gray-700 font-medium">URL da Foto</Label>
                <Input
                  id="photoUrl"
                  type="url"
                  value={formData.photoUrl}
                  onChange={(e) => setFormData(p => ({ ...p, photoUrl: e.target.value }))}
                  placeholder="https://exemplo.com/foto.jpg"
                  className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className="text-gray-700 font-medium">Website / Referência (Opcional)</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData(p => ({ ...p, website: e.target.value }))}
                  className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-gray-700 font-medium">Minibiografia</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(p => ({ ...p, bio: e.target.value }))}
                  className="min-h-[200px] resize-y bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  placeholder="Biografia curta..."
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
