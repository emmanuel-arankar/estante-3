import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/badge';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import {
    checkIsbnAPI, enrichIsbnAPI, searchWorksAPI,
    searchSeriesAPI, createSuggestionAPI, searchPublishersAPI, searchPersonsAPI
} from '@/services/api/booksApi';
import { Work, Person, Series, Publisher } from '@estante/common-types';
import {
    CheckCircle, AlertCircle, Search, BookOpen, BookPlus,
    ChevronRight, ChevronLeft, Hash, X, Building,
    PlusCircle, Users, UserPlus
} from 'lucide-react';
import { languages as bookLanguages } from '@/data/book-languages';
import { sortAlternateNames } from '@/data/alternate-names';
import alternateNameTypesData from '@/data/alternate-name-type.json';
import scriptTypesData from '@/data/script.json';
import bookContributors from '@/data/book-contributors.json';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// ─── Tipos locais ─────────────────────────────────────────────────────────────

const normalizeString = (s: string) => 
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

interface EnrichedData {
    source: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    authors: { name: string; role: string }[];
    publisher: string | null;
    publicationDate: string | null;
    pages: number | null;
    language: string | null;
    coverUrl: string | null;
    isbn13: string | null;
    isbn10: string | null;
    alternateNames?: any[];
    format?: string | null;
    dimensions?: {
        width?: number;
        height?: number;
    };
    weight?: number;
    categories?: string[];
}

interface LinkedAuthor {
    name: string;
    role: string;
    person?: Person;  // se vinculado
}

interface SeriesEntry {
    seriesId?: string;
    seriesName: string;
    position: string;
    isPrimary: boolean;
    isNew?: boolean;  // usuário quer criar nova
}

interface WorkWithFallback extends Work {
    fallbackCoverUrl?: string;
}

interface LinkedPublisher {
    id: string;
    name: string;
    logoUrl?: string;
}

// ─── Steps ────────────────────────────────────────────────────────────────────
const STEPS = ['Busca', 'Obra & Autores', 'Detalhes da Edição', 'Revisão'] as const;

// ─── Componente do Stepper ────────────────────────────────────────────────────
const StepIndicator = ({ current }: { current: number }) => (
    <div className="flex items-center justify-between mb-8 px-4">
        {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1 last:flex-none">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${i < current ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' :
                    i === current ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' :
                        'bg-gray-100 text-gray-400'
                    }`}>
                    {i < current ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                <div className="flex flex-col ml-2 overflow-hidden">
                    <span className={`text-[10px] uppercase font-bold tracking-wider leading-none transition-colors ${i === current ? 'text-emerald-700' : i < current ? 'text-emerald-500' : 'text-gray-400'}`}>
                        Passo {i + 1}
                    </span>
                    <span className={`text-[11px] font-semibold whitespace-nowrap transition-colors ${i === current ? 'text-gray-900' : 'text-gray-400'}`}>
                        {label}
                    </span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-4 rounded-full transition-all duration-500 ${i < current ? 'bg-emerald-500' : 'bg-gray-100'}`} />}
            </div>
        ))}
    </div>
);


// ─── Etapa 1: ISBN ────────────────────────────────────────────────────────────

// Formata "1999-04" → "Abr. 1999", "1999" → "1999", "1999-04-01" → "01 Abr. 1999"
const formatPublicationDate = (raw: string): string => {
    const parts = raw.split('-');
    const months = ['Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai.', 'Jun.', 'Jul.', 'Ago.', 'Set.', 'Out.', 'Nov.', 'Dez.'];
    if (parts.length === 1) return parts[0]; // só ano
    if (parts.length === 2) return `${months[parseInt(parts[1], 10) - 1] ?? ''} ${parts[0]}`.trim();
    return `${parts[2]} ${months[parseInt(parts[1], 10) - 1] ?? ''} ${parts[0]}`.trim();
};

const StepISBN = ({
    isbn, setIsbn, enriched, loading, error, onCheck,
}: {
    isbn: string; setIsbn: (v: string) => void;
    enriched: EnrichedData | null; loading: boolean; error: string | null;
    onCheck: () => void;
}) => {
    const formatIsbn = (raw: string) => raw.replace(/[^\dX]/gi, '');

    return (
        <div className="space-y-5">
            <p className="text-sm text-gray-600">Digite o ISBN-13 ou ISBN-10 do livro. Preencheremos os dados automaticamente.</p>

            <div className="flex gap-2">
                {/* Padronizado: border-gray-200, h-10, rounded-xl */}
                <Input
                    placeholder="Ex: 9788535914849"
                    value={isbn}
                    onChange={e => setIsbn(formatIsbn(e.target.value))}
                    maxLength={13}
                    className="font-mono text-base tracking-widest h-10 border-gray-200 rounded-xl"
                    onKeyDown={e => e.key === 'Enter' && isbn.length >= 10 && onCheck()}
                />
                <Button onClick={onCheck} disabled={loading || isbn.length < 10} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 rounded-xl h-10">
                    {loading ? <Spinner size="sm" /> : <Search className="w-4 h-4" />}
                </Button>
            </div>

            {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                </div>
            )}

            {enriched && (
                <div className="flex gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    {enriched.coverUrl && (
                        <img src={enriched.coverUrl} alt={enriched.title || ''} className="w-16 h-24 object-cover rounded shadow-sm shrink-0" />
                    )}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">
                                Encontrado via {
                                    enriched.source === 'google_books' ? 'Google Books' :
                                    enriched.source === 'open_library' ? 'Open Library' :
                                    enriched.source.includes('cbl') ? 'Brasil API (CBL)' :
                                    enriched.source.includes('mercado_editorial') ? 'Brasil API (Mercado Ed.)' :
                                    'Brasil API'
                                }
                            </span>
                        </div>
                        <p className="font-bold text-gray-900 text-sm line-clamp-2">{enriched.title}</p>
                        {enriched.subtitle && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{enriched.subtitle}</p>}
                        {/* Separadores · apenas quando há item anterior — publisher pode ser null no Google Books */}
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
                            {enriched.publisher && <span>{enriched.publisher}</span>}
                            {enriched.publicationDate && (
                                <>
                                    {enriched.publisher && <span className="opacity-40">·</span>}
                                    <span>{formatPublicationDate(enriched.publicationDate)}</span>
                                </>
                            )}
                            {enriched.pages && (
                                <>
                                    {(enriched.publisher || enriched.publicationDate) && <span className="opacity-40">·</span>}
                                    <span>{enriched.pages} p.</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>
            )}

        </div>
    );
};

// ─── Sub-componente: Linha de Autor ──────────────────────────────────────────

const AuthorRow = ({
    author, linked, onLink, onUnlink, onNameChange, onRoleChange, onRemove
}: {
    author: LinkedAuthor;
    linked?: Person;
    onLink: (p: Person) => void;
    onUnlink: () => void;
    onNameChange: (v: string) => void;
    onRoleChange: (v: string) => void;
    onRemove: () => void;
}) => {
    const [results, setResults] = useState<Person[]>([]);
    const [searching, setSearching] = useState(false);

    const searchAuthors = useCallback(async (q: string) => {
        if (q.length < 2) { setResults([]); return; }
        setSearching(false); // reset searching to trigger spinner correctly if needed
        setSearching(true);
        try {
            const res = await searchPersonsAPI(q);
            setResults(res);
        } catch { setResults([]); }
        finally { setSearching(false); }
    }, []);

    return (
        <div className="group relative flex flex-col gap-2 p-4 bg-white border border-gray-100 rounded-2xl transition-all hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-50/50">
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors relative ${linked ? 'bg-emerald-100 border-2 border-emerald-200' : 'bg-gray-50'}`}>
                    {linked?.photoUrl ? (
                        <>
                            <img src={linked.photoUrl} alt={linked.name} className="w-full h-full rounded-full object-cover" />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                                <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                        </>
                    ) : linked ? (
                        <div className="text-emerald-700 font-sans font-bold text-sm">
                            {linked.name.charAt(0).toUpperCase()}
                        </div>
                    ) : (
                        <div className="text-gray-400 font-sans font-bold text-sm italic">
                            {author.name ? author.name.charAt(0).toUpperCase() : <UserPlus className="w-5 h-5" />}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 grid gap-1 mt-0.5">
                    <div className="flex gap-2 relative">
                        <div className="flex-1 relative flex items-center">
                            <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                            <Input
                                placeholder="Buscar ou inserir colaborador..."
                                value={author.name}
                                onChange={e => {
                                    onNameChange(e.target.value);
                                    if (!linked) searchAuthors(e.target.value);
                                }}
                                className="pl-9 h-9 text-sm rounded-xl font-medium border-gray-200 bg-white focus-visible:ring-emerald-500"
                            />
                            {searching && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}

                            {results.length > 0 && !linked && (
                                <div className="absolute z-50 top-full mt-1 left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto custom-scrollbar">
                                    {results.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                onLink(p);
                                                onNameChange(p.name);
                                                setResults([]);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50 text-left transition-colors border-b border-gray-50 last:border-none"
                                        >
                                            {p.photoUrl ? (
                                                <img src={p.photoUrl} alt={p.name} className="w-9 h-9 rounded-full object-cover shrink-0 shadow-sm" />
                                            ) : (
                                                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center shrink-0 text-gray-500 font-sans font-bold text-xs">
                                                    {p.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-bold text-gray-900 block truncate leading-tight">{p.name}</span>
                                                {p.alternateNames && p.alternateNames.length > 0 && (
                                                    <span className="text-[10px] text-gray-500 block truncate font-medium mt-0.5 leading-tight">
                                                        Alt: {p.alternateNames.map(a => a.value).join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Select
                            value={author.role}
                            onValueChange={onRoleChange}
                        >
                            <SelectTrigger className="w-[140px] h-9 text-[11px] font-bold uppercase tracking-wider bg-gray-50 border border-gray-200 rounded-xl px-2 text-gray-500">
                                <SelectValue placeholder="Cargo" />
                            </SelectTrigger>
                            <SelectContent>
                                {bookContributors.roles.map(role => (
                                    <SelectItem key={role.id} value={role.id} className="text-xs font-medium uppercase">
                                        {role.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {linked && (
                        <div className="flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-300 mt-1">
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] py-0 h-4 font-bold">PERFIL VINCULADO</Badge>
                            <button onClick={onUnlink} className="text-[10px] text-gray-400 hover:text-red-500 font-bold uppercase tracking-tight">Desvincular</button>
                        </div>
                    )}
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRemove}
                    className="h-8 w-8 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all mt-0.5"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};



// ─── Etapa 2: Obra & Autores ──────────────────────────────────────────────────

const StepWorkAndAuthors = ({
    enriched, linkedWork, setLinkedWork, noWork, setNoWork,
    authors, setAuthors,
}: {
    enriched: EnrichedData;
    linkedWork: WorkWithFallback | null; setLinkedWork: (w: WorkWithFallback | null) => void;
    noWork: boolean; setNoWork: (b: boolean) => void;
    authors: LinkedAuthor[]; setAuthors: (a: LinkedAuthor[]) => void;
}) => {
    const [workQuery, setWorkQuery] = useState('');
    const [workResults, setWorkResults] = useState<WorkWithFallback[]>([]);
    const [searchingWork, setSearchingWork] = useState(false);

    const searchWork = useCallback(async (q: string) => {
        if (q.length < 2) { setWorkResults([]); return; }
        setSearchingWork(true);
        try {
            const res = await searchWorksAPI(q);
            setWorkResults(res.data);
            if (res.data.length > 0 && !linkedWork && !noWork) {
                const exactMatch = res.data.find(w =>
                    w.title.toLowerCase() === q.toLowerCase() ||
                    (w.originalTitle && w.originalTitle.toLowerCase() === q.toLowerCase())
                );
                if (exactMatch) {
                    setLinkedWork(exactMatch);
                    setWorkQuery(exactMatch.title);
                }
            }
        } catch { setWorkResults([]); }
        finally { setSearchingWork(false); }
    }, [linkedWork, noWork, setLinkedWork]);

    useEffect(() => {
        if (!linkedWork && !noWork && enriched.title) {
            searchWork(enriched.title);
        }
    }, []);

    const linkAuthor = (i: number, person: Person) => {
        const next = [...authors];
        next[i] = { ...next[i], person };
        setAuthors(next);
    };

    const unlinkAuthor = (i: number) => {
        const next = [...authors];
        next[i] = { ...next[i], person: undefined };
        setAuthors(next);
    };

    const updateAuthor = (i: number, updates: Partial<LinkedAuthor>) => {
        const next = [...authors];
        next[i] = { ...next[i], ...updates };
        setAuthors(next);
    };

    const removeAuthor = (i: number) => {
        setAuthors(authors.filter((_, idx) => idx !== i));
    };

    const addAuthor = () => {
        setAuthors([...authors, { name: '', role: 'author' }]);
    };

    return (
        <div className="space-y-8">
            {/* Seção de Obra */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Vincular à Obra</h3>
                </div>

                <p className="text-xs text-gray-500">
                    Vincule esta edição a uma obra já existente para manter o histórico e avaliações unificados.
                </p>

                {linkedWork ? (
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 animate-in fade-in zoom-in-95 duration-300">
                        {(linkedWork.coverUrl || linkedWork.fallbackCoverUrl) ? (
                            <img
                                src={linkedWork.coverUrl || linkedWork.fallbackCoverUrl}
                                className="w-10 h-14 object-cover rounded shadow-sm shrink-0"
                                alt="Capa"
                            />
                        ) : (
                            <div className="w-10 h-14 bg-emerald-100 rounded flex items-center justify-center shrink-0 text-emerald-700 font-sans font-bold text-lg overflow-hidden relative">
                                {linkedWork.title.charAt(0).toUpperCase()}
                                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600/10 to-transparent" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest leading-none">Obra vinculada</p>
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                            </div>
                            <p className="font-bold text-emerald-950 text-base leading-tight truncate">{linkedWork.title}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setLinkedWork(null); setWorkQuery(''); }}
                            className="text-emerald-400 hover:text-emerald-600 h-8 w-8"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="relative">
                            <Input
                                placeholder={`Buscar obra: "${enriched.title}"`}
                                value={workQuery}
                                onChange={e => { setWorkQuery(e.target.value); searchWork(e.target.value); }}
                                disabled={noWork}
                                className="pl-10 h-10 border-gray-200 rounded-xl transition-all focus:ring-emerald-500"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {searchingWork && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}

                            {workResults.length > 0 && !noWork && (
                                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                                    {workResults.map(work => (
                                        <button
                                            key={work.id}
                                            onClick={() => { setLinkedWork(work); setWorkResults([]); setWorkQuery(work.title); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 text-left transition-colors"
                                        >
                                            {(work.coverUrl || work.fallbackCoverUrl) ? (
                                                <img
                                                    src={work.coverUrl || work.fallbackCoverUrl}
                                                    alt={work.title}
                                                    className="w-8 h-12 object-cover rounded shrink-0 shadow-sm"
                                                />
                                            ) : (
                                                <div className="w-8 h-12 bg-emerald-50 rounded flex items-center justify-center shrink-0 text-emerald-600 font-sans font-bold text-sm">
                                                    {work.title.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 line-clamp-1">{work.title}</p>
                                                <p className="text-xs text-gray-500">{work.primaryAuthors?.map(a => a.name).join(', ')}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all duration-300 ${noWork ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'hover:bg-gray-50 border-gray-100'}`}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${noWork ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300'}`}>
                                {noWork && <CheckCircle className="w-3.5 h-3.5" />}
                                <input type="checkbox" checked={noWork} onChange={e => { setNoWork(e.target.checked); if (e.target.checked) setLinkedWork(null); }}
                                    className="sr-only" />
                            </div>
                            <div className="flex-1">
                                <p className={`text-sm font-bold flex items-center gap-1.5 ${noWork ? 'text-indigo-900' : 'text-gray-900'}`}>
                                    <BookPlus className={`w-4 h-4 ${noWork ? 'text-indigo-600' : 'text-gray-400'}`} />
                                    Esta obra ainda não existe no catálogo
                                </p>
                                <p className={`text-xs mt-0.5 ${noWork ? 'text-indigo-600/80' : 'text-gray-500'}`}>
                                    Uma nova obra será criada automaticamente junto com esta edição.
                                </p>
                            </div>
                        </label>
                    </div>
                )}
            </div>

            {/* Seção de Autores */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Colaboradores</h3>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={addAuthor}
                        className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-bold text-xs"
                    >
                        <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                        ADICIONAR
                    </Button>
                </div>

                <div className="grid gap-3">
                    {authors.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-2xl">
                            <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">Nenhum colaborador adicionado ainda.</p>
                        </div>
                    ) : (
                        authors.map((a, i) => (
                            <AuthorRow
                                key={i} author={a} linked={a.person}
                                onLink={p => linkAuthor(i, p)} onUnlink={() => unlinkAuthor(i)}
                                onNameChange={val => updateAuthor(i, { name: val })}
                                onRoleChange={val => updateAuthor(i, { role: val })}
                                onRemove={() => removeAuthor(i)}
                            />
                        ))
                    )}
                </div>
            </div>

        </div>
    );
};

// ─── Etapa 3: Detalhes da Edição ──────────────────────────────────────────────

const StepEditionDetails = ({
    enriched, publisher, setPublisher, imprint, setImprint,
    alternateNames, setAlternateNames,
    seriesEntries, setSeriesEntries,
}: {
    enriched: EnrichedData;
    publisher: LinkedPublisher | null;
    setPublisher: (p: LinkedPublisher | null) => void;
    imprint: { id: string; name: string } | null;
    setImprint: (i: { id: string; name: string } | null) => void;
    alternateNames: any[]; setAlternateNames: (names: any[]) => void;
    seriesEntries: SeriesEntry[]; setSeriesEntries: (s: SeriesEntry[]) => void;
}) => {
    // Publisher State
    const [pubQuery, setPubQuery] = useState('');
    const [pubResults, setPubResults] = useState<Publisher[]>([]);
    const [searchingPub, setSearchingPub] = useState(false);
    const [selectedPubData, setSelectedPubData] = useState<Publisher | null>(null);

    // Series State
    const [seriesQuery, setSeriesQuery] = useState('');
    const [seriesResults, setSeriesResults] = useState<Series[]>([]);
    const [searchingSeries, setSearchingSeries] = useState(false);
    const [newSeriesName, setNewSeriesName] = useState('');
    const [newPosition, setNewPosition] = useState('');

    useEffect(() => {
        if (!publisher && enriched.publisher && !pubQuery) {
            setPubQuery(enriched.publisher);
            searchPubs(enriched.publisher);
        }
    }, [enriched.publisher]);

    const searchPubs = async (q: string) => {
        if (q.length < 2) { setPubResults([]); return; }
        setSearchingPub(true);
        try {
            const results = await searchPublishersAPI(q);
            setPubResults(results);

            // Auto-vínculo inteligente se houver um match exato (normalizado)
            if (results.length > 0 && !publisher) {
                const normalizedQ = normalizeString(q);
                // Procura um match exato entre os resultados
                const exactMatch = results.find(p =>
                    normalizeString(p.name) === normalizedQ ||
                    p.alternateNames?.some((alt: any) => normalizeString(typeof alt === 'string' ? alt : alt.value) === normalizedQ)
                );

                if (exactMatch) {
                    selectPublisher(exactMatch);
                }
            }
        }
        catch { setPubResults([]); } finally { setSearchingPub(false); }
    };

    const selectPublisher = (p: Publisher) => {
        setPublisher({ id: p.id, name: p.name, logoUrl: p.logoUrl });
        setSelectedPubData(p);
        setImprint(null);
        setPubResults([]);
        setPubQuery('');
    };

    // Alternate Names Logic
    const addName = () => setAlternateNames([...alternateNames, { value: '', language: '', script: '', type: '' }]);
    const updateName = (i: number, f: string, v: string) => {
        const next = [...alternateNames];
        next[i] = { ...next[i], [f]: v };
        setAlternateNames(next);
    };
    const removeName = (i: number) => setAlternateNames(alternateNames.filter((_, idx) => idx !== i));

    // Series Logic
    const searchSeries = async (q: string) => {
        if (q.length < 2) { setSeriesResults([]); return; }
        setSearchingSeries(true);
        try { setSeriesResults(await searchSeriesAPI(q)); }
        catch { setSeriesResults([]); } finally { setSearchingSeries(false); }
    };

    const addExistingSeries = (s: Series) => {
        if (seriesEntries.some(e => e.seriesId === s.id)) return;
        setSeriesEntries([...seriesEntries, {
            seriesId: s.id, seriesName: s.name, position: '', isPrimary: seriesEntries.length === 0,
        }]);
        setSeriesResults([]); setSeriesQuery('');
    };

    const addNewSeries = () => {
        if (!newSeriesName.trim() || !newPosition.trim()) return;
        setSeriesEntries([...seriesEntries, {
            isNew: true, seriesName: newSeriesName.trim(), position: newPosition.trim(),
            isPrimary: seriesEntries.length === 0,
        }]);
        setNewSeriesName(''); setNewPosition('');
    };

    const removeSeries = (i: number) => {
        const next = seriesEntries.filter((_, idx) => idx !== i);
        if (next.length > 0 && !next.some(e => e.isPrimary)) next[0].isPrimary = true;
        setSeriesEntries(next);
    };

    return (
        <div className="space-y-8 pb-4">
            {/* Seção 1: Editora e Selo */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                    <Building className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Publicação</h3>
                </div>

                {publisher ? (
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-4">
                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0 border border-emerald-100 overflow-hidden">
                                    {publisher.logoUrl ? (
                                        <img src={publisher.logoUrl} alt={publisher.name} className="w-full h-full object-contain p-1" />
                                    ) : (
                                        <Building className="w-6 h-6 text-emerald-600" />
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest leading-none">Editora Vinculada</p>
                                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    </div>
                                    <p className="font-bold text-emerald-950 text-base leading-tight">{publisher.name}</p>
                                    {imprint && (
                                        <div className="flex items-center gap-1.5 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <Hash className="w-3 h-3 text-emerald-600/60" />
                                            <span className="text-[11px] font-bold text-emerald-700/80">Selo: {imprint.name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setPublisher(null); setImprint(null); setSelectedPubData(null); }}
                                className="h-8 w-8 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100/50"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {selectedPubData?.imprints && selectedPubData.imprints.length > 0 && (
                            <div className="pt-3 border-t border-emerald-100/50 space-y-1.5">
                                <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-1">
                                    <Hash className="w-3 h-3" /> Selo Editorial (Opcional)
                                </label>
                                <Select
                                    value={imprint?.id || 'none'}
                                    onValueChange={v => {
                                        const imp = selectedPubData.imprints.find(i => i.id === v);
                                        setImprint(imp ? { id: imp.id, name: imp.name } : null);
                                    }}
                                >
                                    <SelectTrigger className="w-full h-11 rounded-xl bg-white/60 border-none focus:ring-2 focus:ring-emerald-500 text-sm text-emerald-900 font-medium">
                                        <SelectValue placeholder="Nenhum selo / Editora principal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Nenhum selo / Editora principal</SelectItem>
                                        {selectedPubData.imprints.map(imp => (
                                            <SelectItem key={imp.id} value={imp.id}>{imp.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 text-left">
                        <div className="relative">
                            <Input
                                placeholder="Buscar editora..."
                                value={pubQuery}
                                onChange={e => { setPubQuery(e.target.value); searchPubs(e.target.value); }}
                                className="pl-10 h-10 border-gray-200 rounded-xl transition-all focus:ring-emerald-500"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {searchingPub && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}

                            {pubResults.length > 0 && (
                                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto overflow-x-hidden">
                                    {pubResults.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => selectPublisher(p)}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 text-left transition-colors border-b border-gray-50 last:border-none"
                                        >
                                            <Building className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-bold text-gray-900">{p.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {pubQuery.length > 2 && pubResults.length === 0 && !searchingPub && (
                            <p className="text-[11px] text-amber-600 flex items-center gap-1.5 px-1 font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                                <AlertCircle className="w-3.5 h-3.5" /> Editora não encontrada. Será vinculada como texto.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Seção 2: Variações de Nomes */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-2">
                        <BookPlus className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Títulos & Variações</h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={addName} className="h-8 text-emerald-600 hover:text-emerald-700 font-bold text-xs">
                        <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> ADICIONAR
                    </Button>
                </div>

                <div className="grid gap-3">
                    {alternateNames.length === 0 ? (
                        <p className="text-center py-4 text-xs text-gray-400 italic">Nenhum título alternativo (ex: em outro idioma ou alfabeto).</p>
                    ) : (
                        alternateNames.map((alt, i) => (
                            <div key={i} className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-3 relative group animate-in slide-in-from-right-2 duration-300">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeName(i)}
                                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </Button>

                                {/* Correção #4: removido pr-6 para o label alinhar com as colunas abaixo */}
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Título / Variação</label>
                                    {/* Correção #1: border-gray-200 para borda visível, igual aos selects */}
                                    <Input
                                        placeholder="Ex: Título em Japonês ou Original"
                                        value={alt.value || ''}
                                        onChange={e => updateName(i, 'value', e.target.value)}
                                        className="h-10 bg-white border-gray-200 rounded-xl font-medium focus:ring-emerald-500"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Idioma</label>
                                        <Select
                                            value={alt.language || 'none'}
                                            onValueChange={v => updateName(i, 'language', v === 'none' ? '' : v)}
                                        >
                                            {/* Correção #1/#3: h-10, rounded-xl, border-gray-200 + placeholder descritivo */}
                                            <SelectTrigger className={`w-full h-10 text-xs rounded-xl border-gray-200 bg-white focus:ring-emerald-500 ${!alt.language ? 'text-gray-400' : ''}`}>
                                                <SelectValue placeholder="Ex: Japonês" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {/* Correção #3: placeholder descritivo na lista */}
                                                <SelectItem value="none" className="text-gray-400 italic">Selecionar idioma...</SelectItem>
                                                {[...bookLanguages]
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map(l => (
                                                        <SelectItem key={l.id} value={l.id} className="focus:bg-gray-50 focus:text-gray-900 data-[state=checked]:text-emerald-700">
                                                            {l.name} {l.flag}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Escrita</label>
                                        <Select
                                            value={alt.script || 'none'}
                                            onValueChange={v => updateName(i, 'script', v === 'none' ? '' : v)}
                                        >
                                            {/* Correção #1/#3: h-10, rounded-xl, border-gray-200 + placeholder descritivo */}
                                            <SelectTrigger className={`w-full h-10 text-xs rounded-xl border-gray-200 bg-white focus:ring-emerald-500 ${!alt.script ? 'text-gray-400' : ''}`}>
                                                <SelectValue placeholder="Ex: Latino, Kanji" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {/* Correção #3: placeholder descritivo na lista */}
                                                <SelectItem value="none" className="text-gray-400 italic">Selecionar escrita...</SelectItem>
                                                {/* Correção #5: hover neutro */}
                                                <SelectItem value="latn" className="focus:bg-gray-50 focus:text-gray-900 data-[state=checked]:text-emerald-700">Latino</SelectItem>
                                                {scriptTypesData.scripts.map((s: any) => (
                                                    <SelectItem key={s.id} value={s.id} className="focus:bg-gray-50 focus:text-gray-900 data-[state=checked]:text-emerald-700">{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Tipo</label>
                                        <Select
                                            value={alt.type || 'none'}
                                            onValueChange={v => updateName(i, 'type', v === 'none' ? '' : v)}
                                        >
                                            {/* Correção #1/#3: h-10, rounded-xl, border-gray-200 + placeholder descritivo */}
                                            <SelectTrigger className={`w-full h-10 text-xs rounded-xl border-gray-200 bg-white focus:ring-emerald-500 ${!alt.type ? 'text-gray-400' : ''}`}>
                                                <SelectValue placeholder="Ex: Título original" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {/* Correção #3: placeholder descritivo na lista */}
                                                <SelectItem value="none" className="text-gray-400 italic">Selecionar tipo...</SelectItem>
                                                {alternateNameTypesData.types.map((t: any) => (
                                                    <SelectItem key={t.id} value={t.id} className="focus:bg-gray-50 focus:text-gray-900 data-[state=checked]:text-emerald-700">{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Seção 3: Coleções/Séries */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                    <Hash className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Coleções & Séries</h3>
                </div>

                <div className="space-y-3">
                    {seriesEntries.map((entry, i) => (
                        <div key={i} className="flex items-center gap-3 p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-in zoom-in-95 duration-200">
                            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0 border border-indigo-100">
                                <Hash className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 text-sm truncate">{entry.seriesName}</span>
                                    {entry.isNew && <Badge className="text-[9px] h-4 bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none font-bold">NOVA</Badge>}
                                </div>
                                <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Membro da Coleção</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold text-gray-400 block text-center uppercase">Vol/Pos</span>
                                    <Input
                                        value={entry.position}
                                        onChange={e => {
                                            const next = [...seriesEntries];
                                            next[i].position = e.target.value;
                                            setSeriesEntries(next);
                                        }}
                                        className="w-16 h-8 text-center text-xs font-bold rounded-lg bg-white border-indigo-100"
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeSeries(i)}
                                    className="h-8 w-8 text-indigo-300 hover:text-red-500 hover:bg-white"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    <div className="relative">
                        <Input
                            placeholder="Vincular a uma série existente..."
                            value={seriesQuery}
                            onChange={e => { setSeriesQuery(e.target.value); searchSeries(e.target.value); }}
                            className="pl-10 h-10 rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-all focus:ring-emerald-500"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        {searchingSeries && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}

                        {seriesResults.length > 0 && (
                            <div className="absolute z-20 bottom-full mb-1 w-full bg-white border border-gray-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto overflow-x-hidden">
                                {seriesResults.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => addExistingSeries(s)}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 text-left transition-colors border-b border-gray-50 last:border-none"
                                    >
                                        <span className="text-sm font-bold text-gray-900">{s.name}</span>
                                        {s.seriesType && <Badge variant="outline" className="text-[10px] font-bold opacity-60 uppercase">{s.seriesType}</Badge>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50/30 border-2 border-dashed border-gray-100 rounded-2xl p-4 space-y-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <PlusCircle className="w-3.5 h-3.5" /> Criar nova série
                        </p>
                        <div className="flex gap-2">
                            <Input placeholder="Nome da nova série" value={newSeriesName} onChange={e => setNewSeriesName(e.target.value)} className="h-9 text-sm rounded-xl" />
                            <Input placeholder="Vol." value={newPosition} onChange={e => setNewPosition(e.target.value)} className="w-20 h-9 text-sm text-center rounded-xl" />
                        </div>
                        <Button
                            onClick={addNewSeries}
                            disabled={!newSeriesName.trim() || !newPosition.trim()}
                            className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold"
                        >
                            ADICIONAR SÉRIE PERSONALIZADA
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    );
};


// ─── Etapa 7: Revisão e Envio ─────────────────────────────────────────────────

const StepReview = ({
    enriched, linkedWork, noWork, authors, publisher, imprint, alternateNames, seriesEntries,
}: {
    enriched: EnrichedData; linkedWork: Work | null; noWork: boolean;
    authors: LinkedAuthor[];
    publisher: { id: string; name: string } | null;
    imprint: { id: string; name: string } | null;
    alternateNames: any[];
    seriesEntries: SeriesEntry[];
}) => (
    <div className="space-y-5">
        <p className="text-sm text-gray-600">Revise os dados antes de enviar a sugestão ao bibliotecário.</p>

        <div className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
            {enriched.coverUrl && <img src={enriched.coverUrl} alt="" className="w-16 h-24 object-cover rounded shadow-sm shrink-0" />}
            <div className="space-y-1 text-sm min-w-0">
                <p className="font-bold text-gray-900 line-clamp-2">{enriched.title}</p>
                {enriched.subtitle && <p className="text-gray-500 text-xs">{enriched.subtitle}</p>}
                <p className="text-gray-500 text-xs flex items-center gap-1 flex-wrap">
                    {enriched.publisher && <span>{enriched.publisher}</span>}
                    {enriched.publicationDate && (
                        <>
                            {enriched.publisher && <span className="opacity-40">·</span>}
                            <span>{formatPublicationDate(enriched.publicationDate)}</span>
                        </>
                    )}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                    {enriched.isbn13 && <Badge variant="outline" className="text-[10px] font-mono whitespace-nowrap">ISBN: {enriched.isbn13}</Badge>}
                    {enriched.format && <Badge variant="secondary" className="text-[10px] whitespace-nowrap bg-indigo-50 text-indigo-700">{enriched.format}</Badge>}
                    {enriched.pages && <Badge variant="secondary" className="text-[10px] whitespace-nowrap text-gray-600">{enriched.pages} p.</Badge>}
                    {enriched.dimensions && enriched.dimensions.width && enriched.dimensions.height && <Badge variant="outline" className="text-[10px] whitespace-nowrap text-gray-500 border-dashed">{enriched.dimensions.width}x{enriched.dimensions.height} cm</Badge>}
                    {enriched.weight && <Badge variant="outline" className="text-[10px] whitespace-nowrap text-gray-500 border-dashed">{enriched.weight}g</Badge>}
                </div>
            </div>
        </div>

        <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Obra:</dt>
                <dd className="font-medium text-gray-900">
                    {linkedWork ? linkedWork.title : noWork ? <span className="text-indigo-600">Nova obra (pendente)</span> : <span className="text-red-500">–</span>}
                </dd>
            </div>
            <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Autores:</dt>
                <dd className="font-medium text-gray-900 flex flex-wrap gap-1">
                    {authors.map((a, i) => (
                        <Badge key={i} variant={a.person ? 'default' : 'secondary'} className={a.person ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-50 text-amber-700'}>
                            {a.name} {a.person ? '✓' : '(pendente)'}
                        </Badge>
                    ))}
                </dd>
            </div>
            {publisher && (
                <div className="flex gap-2">
                    <dt className="text-gray-500 w-24 shrink-0">Editora:</dt>
                    <dd className="font-medium text-gray-900">
                        {publisher.name} {imprint && <span className="text-gray-500 text-xs">(Selo: {imprint.name})</span>}
                    </dd>
                </div>
            )}
            {alternateNames.length > 0 && (
                <div className="flex gap-2">
                    <dt className="text-gray-500 w-24 shrink-0">Variações:</dt>
                    <dd className="font-medium text-gray-900 flex flex-wrap gap-1">
                        {alternateNames.map((alt, i) => alt.value && (
                            <Badge key={i} variant="outline" className="text-xs">
                                {alt.value} {alt.language || alt.type || alt.script ? `(${[alt.language, alt.script, alt.type].filter(Boolean).join('/')})` : ''}
                            </Badge>
                        ))}
                    </dd>
                </div>
            )}
            {seriesEntries.length > 0 && (
                <div className="flex gap-2">
                    <dt className="text-gray-500 w-24 shrink-0">Coleções:</dt>
                    <dd className="font-medium text-gray-900 flex flex-wrap gap-1">
                        {seriesEntries.map((s, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                                {s.seriesName} #{s.position} {s.isPrimary && '⭐'}
                            </Badge>
                        ))}
                    </dd>
                </div>
            )}
        </dl>

    </div>
);

// ─── Componente Principal ─────────────────────────────────────────────────────

interface SuggestionModalProps {
    open: boolean;
    onClose: () => void;
    initialIsbn?: string;
}

export function SuggestionModal({ open, onClose, initialIsbn = '' }: SuggestionModalProps) {
    const [step, setStep] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to top on step change
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo(0, 0);
        }
    }, [step]);
    const [isbn, setIsbn] = useState(initialIsbn);
    const [enriched, setEnriched] = useState<EnrichedData | null>(null);
    const [enrichLoading, setEnrichLoading] = useState(false);
    const [enrichError, setEnrichError] = useState<string | null>(null);

    // Sincroniza a injeção do cabeçalho de busca toda vez que o modal abre
    useEffect(() => {
        if (open) {
            setIsbn(initialIsbn);
        }
    }, [open, initialIsbn]);
    const [linkedWork, setLinkedWork] = useState<Work | null>(null);
    const [noWork, setNoWork] = useState(false);
    const [authors, setAuthors] = useState<LinkedAuthor[]>([]);
    const [publisher, setPublisher] = useState<LinkedPublisher | null>(null);
    const [imprint, setImprint] = useState<{ id: string; name: string } | null>(null);
    const [alternateNames, setAlternateNames] = useState<any[]>([]);
    const [seriesEntries, setSeriesEntries] = useState<SeriesEntry[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const handleCheckIsbn = async () => {
        if (isbn.length < 10) return;
        setEnrichLoading(true);
        setEnrichError(null);
        try {
            const check = await checkIsbnAPI(isbn);
            if (check.exists && check.edition) {
                setEnrichError('Esta edição já está cadastrada no sistema.');
                setEnriched(null);
                return;
            }
            const data = await enrichIsbnAPI(isbn);

            // Corrige o problema do OpenLibrary enviar o mesmo autor escrito de várias formas / repetido (Dedup by lowercased name)
            const uniqueAuthorsMap = new Map();
            data.authors.forEach(a => {
                const lowerName = a.name.trim().toLowerCase();
                if (!uniqueAuthorsMap.has(lowerName)) {
                    uniqueAuthorsMap.set(lowerName, { name: a.name.trim(), role: a.role });
                }
            });
            const deduplicatedAuthors = Array.from(uniqueAuthorsMap.values());
            data.authors = deduplicatedAuthors;

            setEnriched(data);

            // Auto-vínculo inteligente de autores
            const authorsWithLinking = await Promise.all(deduplicatedAuthors.map(async (a) => {
                try {
                    const results = await searchPersonsAPI(a.name);
                    // Match exato por nome ou nome alternativo
                    const match = results.find(p =>
                        p.name.toLowerCase() === a.name.toLowerCase() ||
                        p.alternateNames?.some(alt => alt.value.toLowerCase() === a.name.toLowerCase())
                    );
                    return { name: a.name, role: a.role, person: match };
                } catch {
                    return { name: a.name, role: a.role };
                }
            }));
            setAuthors(authorsWithLinking);

            // Auto-vínculo inteligente de editora
            if (data.publisher) {
                try {
                    const results = await searchPublishersAPI(data.publisher);
                    const normalizedQuery = normalizeString(data.publisher!);
                    const match = results.find((p: any) =>
                        normalizeString(p.name) === normalizedQuery ||
                        p.alternateNames?.some((alt: any) => {
                            const val = typeof alt === 'string' ? alt : alt.value;
                            return normalizeString(val) === normalizedQuery;
                        })
                    );
                    if (match) {
                        setPublisher({ id: match.id, name: match.name, logoUrl: match.logoUrl });
                    }

                    // Ordenar nomes alternativos se existirem
                    if (data.alternateNames && data.alternateNames.length > 0) {
                        setAlternateNames(sortAlternateNames(data.alternateNames));
                    }
                } catch {
                    // Silencioso
                }
            }
        } catch {
            setEnrichError('Não encontramos dados para este ISBN. Verifique o número e tente novamente.');
            setEnriched(null);
        } finally {
            setEnrichLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!enriched) return;
        setSubmitting(true);
        try {
            const payload = {
                type: 'edition' as const,
                data: {
                    title: enriched.title,
                    subtitle: enriched.subtitle,
                    description: enriched.description,
                    isbn13: enriched.isbn13,
                    isbn10: enriched.isbn10,
                    publisher: publisher ? { id: publisher.id, name: publisher.name } : null,
                    imprint: imprint,
                    publicationDate: enriched.publicationDate,
                    pages: enriched.pages,
                    language: enriched.language,
                    coverUrl: enriched.coverUrl,
                    primaryAuthors: authors
                        .filter(a => a.person)
                        .map(a => ({ id: a.person!.id, name: a.person!.name, type: 'person' })),
                    workId: linkedWork?.id || null,
                    createWork: noWork,
                    entityType: 'edition',
                    // Propriedades Estendidas da Brasil API
                    categories: enriched.categories,
                    format: enriched.format,
                    dimensions: enriched.dimensions,
                    weight: enriched.weight,
                },
                seriesEntries: seriesEntries.map(s => ({
                    seriesId: s.seriesId,
                    seriesName: s.seriesName,
                    position: s.position,
                    isPrimary: s.isPrimary,
                })),
                alternateNames: alternateNames.filter(a => a.value && a.value.trim() !== ''),
                unlinkedAuthors: authors
                    .filter(a => !a.person)
                    .map(a => ({ name: a.name, role: a.role })),
            };

            await createSuggestionAPI(payload);
            toastSuccessClickable('Sugestão enviada! O bibliotecário irá revisar em breve.');
            onClose();
            setStep(0); setIsbn(''); setEnriched(null); setLinkedWork(null);
            setNoWork(false); setAuthors([]); setPublisher(null); setImprint(null); setAlternateNames([]); setSeriesEntries([]);
        } catch {
            toastErrorClickable('Erro ao enviar a sugestão. Tente novamente.');
        } finally {
            setSubmitting(false);
        }
    };

    const stepTitles: Record<number, string> = {
        0: 'Buscar pelo ISBN',
        1: 'Obra & Autores',
        2: 'Detalhes da Edição',
        3: 'Revisar e Enviar',
    };

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0 border-none bg-white rounded-3xl shadow-2xl">
                <DialogHeader className="p-8 pb-4 bg-gray-50/50 border-b border-gray-100">
                    <DialogTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                            <BookPlus className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase tracking-[0.2em] text-emerald-600 font-bold mb-0.5">Sugestão de Livro</span>
                            {stepTitles[step]}
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-6">
                    <StepIndicator current={step} />

                    <div className="max-w-2xl mx-auto">
                        {step === 0 && (
                            <StepISBN
                                isbn={isbn}
                                setIsbn={setIsbn}
                                enriched={enriched}
                                loading={enrichLoading}
                                error={enrichError}
                                onCheck={handleCheckIsbn}
                                onNext={() => setStep(1)}
                            />
                        )}
                        {step === 1 && enriched && (
                            <StepWorkAndAuthors
                                enriched={enriched}
                                linkedWork={linkedWork}
                                setLinkedWork={setLinkedWork}
                                noWork={noWork}
                                setNoWork={setNoWork}
                                authors={authors}
                                setAuthors={setAuthors}
                                onNext={() => setStep(2)}
                                onBack={() => setStep(0)}
                            />
                        )}
                        {step === 2 && enriched && (
                            <StepEditionDetails
                                enriched={enriched}
                                publisher={publisher}
                                setPublisher={setPublisher}
                                imprint={imprint}
                                setImprint={setImprint}
                                alternateNames={alternateNames}
                                setAlternateNames={setAlternateNames}
                                seriesEntries={seriesEntries}
                                setSeriesEntries={setSeriesEntries}
                                onNext={() => setStep(3)}
                                onBack={() => setStep(1)}
                            />
                        )}
                        {step === 3 && enriched && (
                            <StepReview
                                enriched={enriched}
                                linkedWork={linkedWork}
                                noWork={noWork}
                                authors={authors}
                                publisher={publisher}
                                imprint={imprint}
                                alternateNames={alternateNames}
                                seriesEntries={seriesEntries}
                                loading={submitting}
                                onSubmit={handleSubmit}
                                onBack={() => setStep(2)}
                            />
                        )}
                    </div>
                </div>

                {/* Rodapé Fixo de Navegação */}
                <div className="shrink-0 bg-white border-t border-gray-100 p-8 flex items-center justify-between z-10 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)]">
                    {step > 0 ? (
                        <Button
                            variant="outline"
                            onClick={() => setStep(s => s - 1)}
                            disabled={submitting}
                            className="h-11 px-6 rounded-xl border-gray-200"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
                        </Button>
                    ) : (
                        <div />
                    )}

                    {step === 3 ? (
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="bg-emerald-600 hover:bg-emerald-700 h-11 px-8 rounded-xl shadow-lg shadow-emerald-100 text-white flex gap-2 items-center"
                        >
                            {submitting ? <Spinner size="sm" /> : <BookPlus className="w-4 h-4" />}
                            Sugerir Livro
                        </Button>
                    ) : (
                        <Button
                            onClick={() => setStep(s => s + 1)}
                            disabled={
                                (step === 0 && !enriched) ||
                                (step === 1 && ((!linkedWork && !noWork) || authors.length === 0)) ||
                                (step === 2 && !enriched)
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 h-11 px-8 rounded-xl shadow-lg shadow-emerald-100 text-white flex gap-2 items-center"
                        >
                            Próximo <ChevronRight className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
