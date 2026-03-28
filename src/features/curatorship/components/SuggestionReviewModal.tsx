import { useState, useMemo, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ContentSuggestion, reviewSuggestionAPI } from '@/features/books/services/suggestionsApi';
import { searchPublishersAPI, searchPersonsAPI } from '@/features/books/services/booksApi';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, User, Settings, BookOpen, Library, AlertCircle, Clock, Hash, Image, Building, Search, PlusCircle, UserPlus, Trash2 } from 'lucide-react';
import languagesData from '@/data/book-languages.json';
import formatsData from '@/data/book-formats.json';
import { getLanguageName } from '@/data/book-languages';
import { getScriptName } from '@/data/alternate-names';
import bookContributors from '@/data/book-contributors.json';
import { Spinner } from '@/components/ui/Spinner';

// Ordenar idiomas alfabeticamente
const SORTED_LANGUAGES = [...languagesData.languages].sort((a, b) => a.name.localeCompare(b.name));

interface Props {
  suggestion: ContentSuggestion;
  onClose: () => void;
  onReviewed: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  work: 'Nova Obra', edition: 'Nova Edição', person: 'Nova Pessoa',
  group: 'Novo Grupo', publisher: 'Nova Editora', series: 'Nova Série',
  genre: 'Novo Gênero', format: 'Novo Format', correction: 'Correção',
};

const TYPE_ICON_MAP: Record<string, any> = {
  work: BookOpen, edition: BookOpen, person: User,
  group: User, publisher: Library, series: BookOpen,
  default: AlertCircle,
};

const FIELD_LABELS: Record<string, string> = {
  title: 'Título', subtitle: 'Subtítulo', description: 'Sinopse',
  isbn13: 'ISBN-13', isbn10: 'ISBN-10', asin: 'ASIN', language: 'Idioma',
  pages: 'Nº de Páginas', publicationDate: 'Data de Publicação',
  publisher: 'Editora', coverUrl: 'Imagem da Capa', name: 'Nome',
  workId: 'ID da Obra', formatId: 'Formato da Edição',
  imprint: 'Selo / Imprint', editionNumber: 'Nº da Edição',
  dimensions: 'Dimensões', height: 'Altura (cm)', width: 'Largura (cm)', depth: 'Profundidade (cm)',
  weight: 'Peso (g)', createWork: 'Criar Obra', entityType: 'Tipo Entidade',
  alternateNames: 'Variações Locais e Títulos Originais',
};

// Campos que devem ser ignorados no loop automático se necessário
const METADATA_FIELDS = ['id', 'status', 'type', 'data', 'submittedBy', 'submittedByName', 'reviewedBy', 'reviewedByRole', 'reviewNote', 'createdAt', 'resolvedAt', 'corrections', 'targetEntityId'];

// Mascara ISBN
const formatIsbnMask = (val: string, type: 'isbn13' | 'isbn10') => {
  if (!val) return '—';
  const clean = val.replace(/[^\dX]/gi, '');
  if (type === 'isbn13' && clean.length === 13) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 12)}-${clean.slice(12)}`;
  }
  if (type === 'isbn10' && clean.length === 10) {
    return `${clean.slice(0, 1)}-${clean.slice(1, 4)}-${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  return clean;
};

export function SuggestionReviewModal({ suggestion, onClose, onReviewed }: Props) {
  const [reviewNote, setReviewNote] = useState('');

  // Busca de Editoras/Selos
  const [searchingPub, setSearchingPub] = useState(false);
  const [pubResults, setPubResults] = useState<any[]>([]);
  const [searchingImprint, setSearchingImprint] = useState(false);
  const [imprintResults, setImprintResults] = useState<any[]>([]);

  // Estado dos dados editáveis
  const [editableData, setEditableData] = useState<Record<string, any>>(() => {
    // 1. Pegar dados da fonte primária (data) ou da raiz (achatado)
    const d: Record<string, any> = { ...(suggestion.data || {}) };

    // 2. Mesclar todos os outros campos da sugestão que não sejam metadados
    // Isso garante que se 'publisher' estiver na raiz mas não em 'data', ele seja capturado.
    Object.entries(suggestion).forEach(([key, val]) => {
      if (!METADATA_FIELDS.includes(key) && val !== undefined) {
        // Se o campo não existe em 'd', está vazio/nulo ou é um objeto vazio, puxar da raiz
        const isObjectEmpty = val && typeof val === 'object' && Object.keys(val).length === 0;
        const isCurrentEmpty = !d[key] || (typeof d[key] === 'object' && Object.keys(d[key]).length === 0);
        
        if (isCurrentEmpty && !isObjectEmpty) {
          d[key] = val;
        }
      }
    });

    // 3. Normalizar Dimensões
    const dims = d.dimensions || {};
    if (typeof dims === 'object') {
      d.height = d.height || dims.height || '';
      d.width = d.width || dims.width || '';
      d.depth = d.depth || dims.depth || '';
    }

    // 4. Normalizar Editora (Fallback agressivo para múltiplas estruturas)
    const pub = d.publisher || d.publisherId || d.publisher_id || '';
    if (pub && typeof pub === 'object') {
      d.publisherName = pub.name || pub.id || '';
      d.publisherId = pub.id || '';
    } else if (pub) {
      // Se for apenas o nome ou ID como string
      d.publisherName = d.publisherName || d.publisher_name || (typeof pub === 'string' ? pub : '');
      d.publisherId = (typeof pub === 'string' && pub.startsWith('pub_')) ? pub : (d.publisherId || '');
    } else {
      d.publisherName = d.publisherName || '';
      d.publisherId = d.publisherId || '';
    }

    // 5. Normalizar Selo / Imprint
    const imp = d.imprint || d.imprintId || d.imprint_id || '';
    if (imp && typeof imp === 'object') {
      d.imprintName = imp.name || imp.id || '';
      d.imprintId = imp.id || '';
    } else {
      d.imprintName = imp || d.imprintName || '';
      d.imprintId = d.imprintId || '';
    }

    // 6. Normalizar Colaboradores
    let initialAuthors: any[] = [];
    if (d.authors && Array.isArray(d.authors)) initialAuthors.push(...d.authors);
    if (d.contributors && Array.isArray(d.contributors)) initialAuthors.push(...d.contributors);
    if (d.primaryAuthors && Array.isArray(d.primaryAuthors)) {
      // Mapeia primaryAuthors que vem apenas com {id, name, type} para adicionar default role
      initialAuthors.push(...d.primaryAuthors.map(a => ({ ...a, role: 'author' })));
    }
    if (suggestion.unlinkedAuthors && Array.isArray(suggestion.unlinkedAuthors)) {
      initialAuthors.push(...suggestion.unlinkedAuthors);
    }
    
    // Desduplicação simples por ID ou Nome (evita repetições visuais se backend salvar duplicado)
    const pureAuthors: any[] = [];
    initialAuthors.forEach(a => {
      const idMatch = a.id || a.personId;
      const duplicate = pureAuthors.find(p => (idMatch && (p.id === idMatch || p.personId === idMatch)) || (!idMatch && p.name === a.name));
      if (!duplicate) pureAuthors.push(a);
    });
    
    // Caso especial: sugestão de tipo 'person' (autor) vinculada a uma obra no root
    if ((pureAuthors.length === 0) && d.name && suggestion.type === 'person') {
      pureAuthors.push({
        name: d.name,
        personId: d.id || d.personId || d.person_id || suggestion.id,
        role: 'author'
      });
    }

    d.editableAuthors = pureAuthors.map((a: any) => ({
      ...a,
      name: a.name || (typeof a === 'string' ? a : ''),
      personId: a.personId || a.id || (typeof a.person === 'object' ? a.person.id : ''),
      role: a.role || 'author',
      photoUrl: a.photoUrl || (typeof a.person === 'object' ? a.person.photoUrl : '')
    }));

    return d;
  });

  const handleFieldChange = (key: string, value: any) => {
    setEditableData(prev => ({ ...prev, [key]: value }));
  };

  const searchPubs = async (q: string, isImprint = false) => {
    if (q.length < 2) {
      if (isImprint) setImprintResults([]); else setPubResults([]);
      return;
    }
    if (isImprint) setSearchingImprint(true); else setSearchingPub(true);
    try {
      const results = await searchPublishersAPI(q);
      if (isImprint) setImprintResults(results); else setPubResults(results);
    } catch {
      if (isImprint) setImprintResults([]); else setPubResults([]);
    } finally {
      if (isImprint) setSearchingImprint(false); else setSearchingPub(false);
    }
  };

  const { mutate: doReview, isPending } = useMutation({
    mutationFn: (status: 'approved' | 'rejected') => {
      const payload: any = { status, reviewNote: reviewNote || undefined };
      if (status === 'approved') {
        const finalData = { ...editableData };

        // Reconstruir dimensões
        if (finalData.height || finalData.width || finalData.depth) {
          finalData.dimensions = {
            height: finalData.height, width: finalData.width, depth: finalData.depth
          };
        }

        // Reconstruir Editora/Selo
        finalData.publisher = finalData.publisherId
          ? { id: finalData.publisherId, name: finalData.publisherName }
          : finalData.publisherName;

        finalData.imprint = finalData.imprintId
          ? { id: finalData.imprintId, name: finalData.imprintName }
          : finalData.imprintName;

        // Reconstruir Autores
        if (finalData.editableAuthors) {
          finalData.authors = finalData.editableAuthors.map((a: any) => ({
            name: a.name,
            role: a.role,
            personId: a.personId || undefined
          }));
        }

        // Limpar campos de estado temporário
        delete finalData.height; delete finalData.width; delete finalData.depth;
        delete finalData.publisherName; delete finalData.publisherId;
        delete finalData.imprintName; delete finalData.imprintId;
        delete finalData.editableAuthors;

        payload.updatedData = finalData;
      }
      return reviewSuggestionAPI(suggestion.id, payload);
    },
    onSuccess: (_, status) => {
      toastSuccessClickable(status === 'approved' ? 'Sugestão aprovada!' : 'Sugestão rejeitada.');
      onReviewed();
    },
    onError: (err: any) => {
      toastErrorClickable(err?.message ?? 'Erro ao processar revisão.');
    },
  });

  const isPending_ = isPending || suggestion.status !== 'pending';

  const renderField = (key: string, className?: string) => {
    if (METADATA_FIELDS.includes(key) && key !== 'name' && key !== 'id') return null; // id e name podem ser dados reais em alguns casos
    const label = FIELD_LABELS[key] ?? key;
    const value = editableData[key] ?? '';
    const isPending = suggestion.status === 'pending';
    const isIsbn = key === 'isbn13' || key === 'isbn10';

    // Determinar tipo de input
    const isNumberField = ['editionNumber', 'height', 'width', 'depth', 'weight', 'pages'].includes(key);

    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
          {label}
        </label>

        {isPending ? (
          isIsbn ? (
            <div className="bg-gray-100/50 p-4 rounded-2xl border border-gray-100 text-sm text-gray-700 font-mono tracking-wider flex items-center justify-between h-14">
              <span>{formatIsbnMask(String(value), key as any)}</span>
              <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold uppercase transition-colors">
                <Clock className="w-3 h-3" /> Bloqueado
              </div>
            </div>
          ) : key === 'description' ? (
            <textarea
              value={String(value)}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              className="p-4 w-full text-sm bg-white border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl transition-all shadow-sm leading-relaxed outline-none"
              rows={6}
            />
          ) : key === 'language' ? (
            <Select value={String(value)} onValueChange={(v) => handleFieldChange(key, v)}>
              <SelectTrigger className="h-14 p-4 w-full text-sm bg-white border-gray-200 focus:border-emerald-500 rounded-2xl outline-none">
                <SelectValue placeholder="Selecione um Idioma" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {SORTED_LANGUAGES.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    <div className="flex items-center justify-between w-full min-w-[200px]">
                      <span>{l.name}</span>
                      <span className="text-gray-400 text-lg ml-2">{l.flag}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : key === 'formatId' ? (
            <Select value={String(value)} onValueChange={(v) => handleFieldChange(key, v)}>
              <SelectTrigger className="h-14 p-4 w-full text-sm bg-white border-gray-200 focus:border-emerald-500 rounded-2xl outline-none">
                <SelectValue placeholder="Formato da Edição" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {formatsData.categories.map(cat => (
                  <SelectGroup key={cat.id}>
                    <SelectLabel className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold mt-2 px-4">{cat.name}</SelectLabel>
                    {cat.formats.map(f => (
                      <SelectItem key={f.id} value={f.id} className="pl-6">{f.name}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          ) : key === 'publicationDate' ? (
            <Input
              type="text"
              placeholder="AAAA ou AAAA-MM ou AAAA-MM-DD"
              value={String(value)}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              className="h-14 p-4 w-full text-sm bg-white border-gray-200 focus:border-emerald-500 rounded-2xl outline-none font-medium"
            />
          ) : (
            <Input
              type={isNumberField ? "number" : "text"}
              value={String(value)}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              min={isNumberField ? "0" : undefined}
              className="h-14 p-4 w-full text-sm bg-white border-gray-200 focus:border-emerald-500 rounded-2xl outline-none font-medium"
            />
          )
        ) : (
          <div className="bg-white p-4 rounded-2xl border border-gray-100 text-sm text-gray-700 shadow-sm leading-relaxed min-h-[3.5rem] flex items-center">
            {isIsbn ? formatIsbnMask(String(value), key as any) : (String(value) || <span className="text-gray-300 italic">Vazio</span>)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0 border-none bg-white rounded-3xl shadow-2xl">
        {/* Header Padronizado */}
        <DialogHeader className="bg-gray-50/50 border-b border-gray-100 p-8 pb-4">
          <DialogTitle className="flex items-center gap-4 text-xl font-bold text-gray-900">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              {(() => {
                const Icon = TYPE_ICON_MAP[suggestion.type] ?? TYPE_ICON_MAP.default;
                return <Icon className="w-6 h-6" />;
              })()}
            </div>
            <div>
              <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-0.5 leading-none">
                {TYPE_LABELS[suggestion.type] ?? suggestion.type}
              </span>
              <span className="block leading-tight">
                {editableData.title || editableData.name || 'Detalhes do Envio'}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar bg-white">
          <div className="space-y-10 pb-8">
            {/* Seção OBRA */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Informações da Obra</h3>
              </div>
              <div className="grid grid-cols-1 gap-6 bg-gray-50/30 p-8 rounded-3xl border border-gray-100">
                {renderField('title')}
                {renderField('subtitle')}
                {renderField('description')}
              </div>
            </section>

            {/* Seção IDENTIDADE */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 shadow-sm">
                  <Hash className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Identidade & Volume</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 bg-gray-50/30 p-8 rounded-3xl border border-gray-100">
                {renderField('isbn13')}
                {renderField('isbn10')}
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  {renderField('asin')}
                  {renderField('pages')}
                </div>
                {renderField('formatId')}
                {renderField('editionNumber')}
                <div className="md:col-span-2 grid grid-cols-4 gap-4">
                  {renderField('height')}
                  {renderField('width')}
                  {renderField('depth')}
                  {renderField('weight')}
                </div>
              </div>
            </section>

            {/* Seção PUBLICAÇÃO */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shadow-sm">
                  <Building className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Publicação & Idioma</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 bg-gray-50/30 p-8 rounded-3xl border border-gray-100">
                {/* Editora */}
                <AutolinkField
                  label="Editora"
                  value={editableData.publisherName}
                  id={editableData.publisherId}
                  searching={searchingPub}
                  results={pubResults}
                  onSearch={q => searchPubs(q, false)}
                  onChange={(name, id) => {
                    handleFieldChange('publisherName', name);
                    handleFieldChange('publisherId', id);
                  }}
                />

                {/* Selo / Imprint */}
                <AutolinkField
                  label="Selo / Imprint"
                  value={editableData.imprintName}
                  id={editableData.imprintId}
                  searching={searchingImprint}
                  results={imprintResults}
                  onSearch={q => searchPubs(q, true)}
                  onChange={(name, id) => {
                    handleFieldChange('imprintName', name);
                    handleFieldChange('imprintId', id);
                  }}
                />

                {renderField('publicationDate')}
                {renderField('language')}
              </div>
            </section>

            {/* Seção COLABORADORES */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Colaboradores da Obra</h3>
                </div>
                {suggestion.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-50"
                    onClick={() => {
                      const newAuthors = [...(editableData.editableAuthors || []), { name: '', role: 'author', personId: '' }];
                      handleFieldChange('editableAuthors', newAuthors);
                    }}
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Adicionar
                  </Button>
                )}
              </div>
              <div className="grid gap-4 bg-gray-50/30 p-8 rounded-3xl border border-gray-100">
                {editableData.editableAuthors?.length > 0 ? (
                  editableData.editableAuthors.map((auth: any, idx: number) => (
                    <AuthorEditRow
                      key={idx}
                      author={auth}
                      isEditable={suggestion.status === 'pending'}
                      onUpdate={(updates) => {
                        const next = [...editableData.editableAuthors];
                        next[idx] = { ...next[idx], ...updates };
                        handleFieldChange('editableAuthors', next);
                      }}
                      onRemove={() => {
                        const next = editableData.editableAuthors.filter((_: any, i: number) => i !== idx);
                        handleFieldChange('editableAuthors', next);
                      }}
                    />
                  ))
                ) : (
                  <div className="py-10 text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-gray-200 mx-auto" />
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Nenhum autor mencionado</p>
                  </div>
                )}
              </div>
            </section>

            {/* Seção MÍDIA */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600 shadow-sm">
                  <Image className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Mídia & Identidade Visual</h3>
              </div>
              <div className="bg-gray-50/30 p-8 rounded-3xl border border-gray-100 space-y-8 text-center">
                {renderField('coverUrl')}
                {editableData.coverUrl && (
                  <div className="relative mx-auto w-44 aspect-[2/3] animate-in zoom-in-95 duration-700">
                    <div className="absolute inset-0 bg-gray-200 rounded-lg shadow-2xl overflow-hidden group">
                      <img src={editableData.coverUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-y-0 left-0 w-[5%] bg-gradient-to-r from-black/20 to-transparent" />
                      <div className="absolute inset-y-0 left-[5%] w-[1px] bg-white/10" />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Nota de Revisão */}
            {suggestion.status === 'pending' && (
              <section className="bg-emerald-50/20 p-8 rounded-3xl border border-emerald-100/30">
                <label className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-widest mb-5 px-1">
                  <Settings className="w-5 h-5" />
                  Justificativa da Decisão <span className="text-emerald-500/50 font-medium normal-case ml-1">(Opcional)</span>
                </label>
                <textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Ex: Dados confirmados pela editora..."
                  rows={3}
                  className="p-5 w-full text-sm bg-white border-emerald-100 focus:border-emerald-500 rounded-2xl outline-none font-medium italic"
                />
              </section>
            )}
          </div>
        </div>

        {/* Footer Fixo Padronizado */}
        {suggestion.status === 'pending' && (
          <div className="shrink-0 bg-white border-t border-gray-100 p-8 flex items-center justify-between gap-5 z-10 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)]">
            <Button variant="ghost" onClick={onClose} disabled={isPending_} className="text-gray-400 font-bold hover:text-gray-900 rounded-xl px-6 h-11 transition-all">
              Fechar sem decidir
            </Button>
            <div className="flex gap-4">
              <Button onClick={() => doReview('rejected')} disabled={isPending_} className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-50 rounded-xl px-8 h-11 font-bold shadow-lg shadow-red-100/50 flex gap-2 items-center">
                <XCircle className="w-5 h-5" /> Rejeitar
              </Button>
              <Button onClick={() => doReview('approved')} disabled={isPending_} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-10 h-11 font-bold shadow-lg shadow-emerald-100 flex gap-2 items-center">
                <CheckCircle className="w-5 h-5" /> Aprovar Envio
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function AutolinkField({ label, value, id, searching, results, onSearch, onChange }: {
  label: string, value: string, id: string, searching: boolean, results: any[],
  onSearch: (q: string) => void, onChange: (name: string, id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 relative">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{label}</label>
      <div className="relative">
        <Input
          value={String(value || '')}
          onChange={(e) => {
            onChange(e.target.value, '');
            onSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="h-14 p-4 pl-10 w-full text-sm bg-white border-gray-200 focus:border-emerald-500 rounded-2xl outline-none"
          placeholder="Buscar ou digitar..."
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        {searching && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}

        {isOpen && results?.length > 0 && (
          <div className="absolute z-50 top-full mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-52 overflow-y-auto animate-in slide-in-from-top-2">
            {results.map((p: any) => (
              <button
                key={p.id}
                onClick={() => {
                  onChange(p.name, p.id);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 text-left transition-colors border-b border-gray-50 last:border-none"
              >
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                  {p.logoUrl ? <img src={p.logoUrl} className="w-full h-full object-contain p-1" /> : <Building className="w-4 h-4 text-gray-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 line-clamp-1">{p.name}</p>
                  <p className="text-[9px] text-emerald-600 uppercase tracking-widest font-bold">Vincular Perfil ✓</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {id && (
        <div className="flex items-center gap-1.5 mt-1 px-1">
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Vinculado ao Catálogo</span>
        </div>
      )}
    </div>
  );
}

function AuthorEditRow({ author, isEditable, onUpdate, onRemove }: {
  author: any, isEditable: boolean, onUpdate: (updates: any) => void, onRemove: () => void
}) {
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const searchAuthors = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await searchPersonsAPI(q);
      setResults(res);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm relative group overflow-visible">
      <div className="relative shrink-0">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border-2 transition-colors ${author.personId ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}>
          {author.photoUrl ? (
            <img src={author.photoUrl} className="w-full h-full object-cover" />
          ) : (
            <User className={`w-6 h-6 ${author.personId ? 'text-emerald-500' : 'text-gray-300'}`} />
          )}
        </div>
        {author.personId && (
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-white shadow-sm">
            <CheckCircle className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 w-full relative">
        <div className="relative">
          <Input
            value={author.name}
            onChange={(e) => {
              onUpdate({ name: e.target.value, personId: '', photoUrl: '' });
              searchAuthors(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Nome do colaborador..."
            className="h-11 px-4 text-sm font-bold text-gray-900 border-gray-200 focus:border-emerald-500 rounded-xl outline-none"
          />
          {searching && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}

          {isOpen && results.length > 0 && (
            <div className="absolute z-50 top-full mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-52 overflow-y-auto animate-in slide-in-from-top-2">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onUpdate({ name: p.name, personId: p.id, photoUrl: p.photoUrl });
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50 text-left transition-colors border-b border-gray-50 last:border-none"
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                    {p.photoUrl ? <img src={p.photoUrl} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Vincular Perfil ✓</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Select value={author.role} onValueChange={(r) => onUpdate({ role: r })}>
          <SelectTrigger className="h-11 px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-gray-200 rounded-xl outline-none">
            <SelectValue placeholder="Cargo..." />
          </SelectTrigger>
          <SelectContent>
            {bookContributors.roles.map(r => (
              <SelectItem key={r.id} value={r.id} className="text-xs font-bold uppercase tracking-widest">{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isEditable && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-10 w-10 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
