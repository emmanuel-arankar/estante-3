import { useLoaderData, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Edition } from '@estante/common-types';
import { editionQuery, workQuery } from '@/features/books/books.queries';
import { formatPublicationDate, isFutureDate } from '@/lib/utils';
import { formatISBN } from '@/lib/isbn';
import { PageMetadata } from '@/components/seo/PageMetadata';
import { PATHS } from '@/router/paths';
import { ShelfButton } from '@/features/books/components/ShelfButton';
import { StarRating } from '@/features/books/components/StarRating';
import { ContributorsList } from '@/features/books/components/ContributorsList';
import { ShelfTagsPanel } from '@/features/books/components/ShelfTagsPanel';
import { ReviewsTab } from '@/features/books/components/ReviewsTab';
import { getLanguageName, getLanguageFlag } from '@/data/book-languages';
import { getFormatById, getCategoryIconByFormatId } from '@/data/book-formats';
// Alternate names imports removed as they were unused
import { BookOpen, Tablet, Headphones, Trash2 } from 'lucide-react';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import { ReadMore } from '@/features/books/components/ReadMore';
import { AuthorBioSection } from '@/features/books/components/AuthorBioSection';
import { EditionsCarousel } from '@/features/books/components/EditionsCarousel';
import { myReviewByEditionQuery } from '@/features/books/reviews.queries';
import { createReviewAPI, updateReviewAPI, deleteReviewAPI } from '@/services/api/reviewsApi';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
import {
    Breadcrumb,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { motion } from 'framer-motion';
import { Home, Book, ChevronRight } from 'lucide-react';
import { itemVariants, SMOOTH_TRANSITION } from '@/lib/animations';

const FormatIcon = ({ formatId }: { formatId: string }) => {
    const iconName = getCategoryIconByFormatId(formatId);
    switch (iconName) {
        case 'tablet': return <Tablet className="w-4 h-4 mr-1.5 inline text-gray-400" />;
        case 'headphones': return <Headphones className="w-4 h-4 mr-1.5 inline text-gray-400" />;
        case 'book-open':
        default: return <BookOpen className="w-4 h-4 mr-1.5 inline text-gray-400" />;
    }
};

export function BookPage() {
    const { edition: initialEdition } = useLoaderData() as { edition: Edition };

    // React Query mantém os dados sincronizados
    const { data: edition } = useQuery({
        ...editionQuery(initialEdition.id),
        initialData: initialEdition,
    });

    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Rastrear visualização do livro
    useEffect(() => {
        if (edition?.id) {
            trackEvent('book_viewed', {
                edition_id: edition.id,
                work_id: edition.workId,
                title: edition.title,
            });
        }
    }, [edition?.id]);

    const { data: myReviewRes } = useQuery(myReviewByEditionQuery(edition?.id, !!user));
    const myReview = myReviewRes?.data;

    const handleRate = async (rating: number) => {
        if (!user) {
            toastErrorClickable('Faça login para avaliar uma edição.');
            return;
        }
        try {
            if (myReview) {
                await updateReviewAPI(myReview.id, { rating });
            } else {
                await createReviewAPI({
                    editionId: edition.id,
                    workId: work?.id || edition.workId,
                    rating,
                    content: '',
                    containsSpoiler: false
                });
            }
            queryClient.invalidateQueries({ queryKey: ['reviews'] });
            queryClient.invalidateQueries({ queryKey: ['editions'] });
            toastSuccessClickable('Sua avaliação foi salva!');
        } catch (err) {
            toastErrorClickable('Ocorreu um erro ao registrar sua avaliação.');
        }
    };

    const handleDeleteRating = async () => {
        if (!myReview) return;
        try {
            const isEmptyReview = !myReview.content && !myReview.title;
            if (isEmptyReview) {
                await deleteReviewAPI(myReview.id);
            } else {
                await updateReviewAPI(myReview.id, { rating: null });
            }
            queryClient.invalidateQueries({ queryKey: ['reviews'] });
            queryClient.invalidateQueries({ queryKey: ['editions'] });
            toastSuccessClickable('Avaliação removida!');
        } catch (err) {
            toastErrorClickable('Erro ao remover a avaliação.');
        }
    };

    // Carregar Work Details se existir (prefetch feito no loader)
    const { data: work } = useQuery({
        ...workQuery(edition.workId),
        enabled: !!edition.workId,
    });

    if (!edition) return null;

    // Gerar SEO
    const displaySubtitle = edition.subtitle || work?.subtitle;
    const seoTitle = `${edition.title} ${displaySubtitle ? `- ${displaySubtitle}` : ''} | Estante de Bolso`;
    const seoDesc = edition.description?.slice(0, 150) || 'Detalhes do livro na Estante de Bolso.';

    return (
        <>
            <PageMetadata
                title={seoTitle}
                description={seoDesc}
            />

            <div className="min-h-screen bg-gray-50 pb-20">
                <div className="max-w-7xl mx-auto px-4">
                    {/* Breadcrumb Premium Estilo Perfil (Réplica Exata do Global) */}
                    <Breadcrumb className="hidden md:flex mt-4 mb-2">
                        <BreadcrumbList>
                            {/* Home */}
                            <motion.li
                                key="home"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                className="inline-flex items-center gap-1.5"
                                transition={SMOOTH_TRANSITION}
                            >
                                <BreadcrumbLink asChild>
                                    <Link to={PATHS.HOME} aria-label="Página Inicial" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
                                        <Home className="h-4 w-4 text-gray-500" />
                                    </Link>
                                </BreadcrumbLink>
                            </motion.li>

                            {/* Separator */}
                            <motion.li key="sep1" variants={itemVariants} transition={SMOOTH_TRANSITION} className="inline-flex items-center text-gray-300">
                                <ChevronRight className="h-3.5 w-3.5" />
                            </motion.li>

                            {/* Obra */}
                            <motion.li
                                key="work"
                                variants={itemVariants}
                                transition={{ ...SMOOTH_TRANSITION, delay: 0.08 }}
                                className="inline-flex items-center gap-1.5"
                            >
                                <BreadcrumbPage className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-foreground">
                                    <Book className="h-4 w-4" />
                                    {work?.title || edition.title}
                                </BreadcrumbPage>
                            </motion.li>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                        {/* Esquerda: Capa e Ações Principais */}
                        <div className="lg:col-span-3">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sticky top-6">
                                <div className="aspect-[2/3] relative rounded-lg overflow-hidden bg-gray-100 shadow-md mb-6">
                                    {edition.coverUrl ? (
                                        <img
                                            src={edition.coverUrl}
                                            alt={`Capa de ${edition.title}`}
                                            className="object-cover w-full h-full"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <span className="text-sm font-medium">Sem capa</span>
                                        </div>
                                    )}
                                </div>

                                {/* Shelf Button */}
                                <ShelfButton
                                    editionId={edition.id}
                                    workId={edition.workId}
                                />

                                {/* Shelf Tags Panel */}
                                <ShelfTagsPanel editionId={edition.id} />

                                {/* Rating Widget Component */}
                                <div className="mt-6 pt-6 border-t border-gray-100 relative group">
                                    <p className="text-sm font-medium text-gray-700 mb-3 text-center">Sua Avaliação</p>
                                    <StarRating
                                        rating={myReview?.rating || 0}
                                        interactive={true}
                                        size="lg"
                                        className="justify-center"
                                        onRate={handleRate}
                                    />
                                    {myReview?.rating && (
                                        <button
                                            onClick={handleDeleteRating}
                                            className="absolute top-6 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Remover avaliação">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Centro: Informações Principais */}
                        <div className="lg:col-span-6">
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                    {edition.title}
                                </h1>
                                {(edition.subtitle || work?.subtitle) && (
                                    <h2 className="text-xl text-gray-600 mb-4">{edition.subtitle || work?.subtitle}</h2>
                                )}

                                <div className="mb-6">
                                    <ContributorsList
                                        key={`contributors-${edition.id}`}
                                        contributors={edition.contributors}
                                    />
                                </div>

                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 border-b-2 border-gray-100 pb-6">
                                    <StarRating rating={edition.stats?.averageRating || 0} size="sm" showLabel={false} />
                                    <div className="flex items-center gap-1 text-yellow-600">
                                        <span className="font-bold text-gray-900 text-[14px]">{edition.stats?.averageRating?.toFixed(2).replace('.', ',') || '0,00'}</span>
                                        <div className="flex items-center gap-2 text-gray-500 ml-1 text-[14px]">
                                            <span className="text-gray-300">•</span>
                                            <span>{edition.stats?.ratingsCount === 1 ? '1 avaliação' : `${edition.stats?.ratingsCount || 0} avaliações`}</span>
                                            <span className="text-gray-300">•</span>
                                            <span>{edition.stats?.reviewsCount === 1 ? '1 resenha' : `${edition.stats?.reviewsCount || 0} resenhas`}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-10 pt-10 border-t-2 border-gray-100 mb-6">
                                    <h3 className="text-lg font-bold text-gray-900 mb-3 text-left">Sinopse</h3>
                                    <ReadMore
                                        key={`synopsis-${edition.id}`}
                                        html={edition.description || '<p>Nenhuma sinopse disponível.</p>'}
                                        lines={6}
                                    />
                                </div>

                                {/* Autor Principal (Bio) */}
                                {edition.contributors && edition.contributors.length > 0 && (
                                    <AuthorBioSection
                                        key={`author-bio-${edition.id}`}
                                        contributors={edition.contributors}
                                    />
                                )}

                                {work?.id && (
                                    <EditionsCarousel
                                        workId={work.id}
                                        currentEditionId={edition.id}
                                    />
                                )}

                                {/* Avaliações e Resenhas */}
                                <div className="mt-10 pt-10 border-t-2 border-gray-100">
                                    <ReviewsTab
                                        editionId={edition.id}
                                        workId={work?.id || edition.workId}
                                        myReview={myReview}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Direita: Sidebar (Detalhes, Onde Comprar, Tags) */}
                        <div className="lg:col-span-3 space-y-6">

                            {/* Onde Comprar */}
                            {edition.purchaseLinks && edition.purchaseLinks.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                                    <h4 className="font-bold text-gray-900 mb-4">Onde comprar</h4>
                                    <div className="space-y-3">
                                        {edition.purchaseLinks.map((link, idx) => (
                                            <a
                                                key={idx}
                                                href={link.affiliateUrl || link.originalUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/50 transition-colors"
                                            >
                                                <span className="font-medium text-gray-700">{link.platform}</span>
                                                {link.lastPrice && (
                                                    <span className="text-indigo-600 font-bold">
                                                        {link.currency || 'R$'} {link.lastPrice.toFixed(2)}
                                                    </span>
                                                )}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Detalhes da Obra Original */}
                            {work && (work.originalTitle || work.originalPublicationDate || work.originalLanguage) && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-6">
                                    <h4 className="font-bold text-gray-900 mb-4">Detalhes da Obra</h4>
                                    <dl className="space-y-3 text-sm">
                                        {work.originalTitle && work.originalTitle !== edition.title && (
                                            <div className="flex justify-between">
                                                <dt className="text-gray-500">Título original</dt>
                                                <dd className="font-medium text-gray-900 text-right italic">{work.originalTitle}</dd>
                                            </div>
                                        )}
                                        {work.originalPublicationDate && (
                                            <div className="flex justify-between">
                                                <dt className="text-gray-500">Publicação original</dt>
                                                <dd className="font-medium text-gray-900 text-right">{formatPublicationDate(work.originalPublicationDate)}</dd>
                                            </div>
                                        )}
                                        {work.originalLanguage && (
                                            <div className="flex justify-between">
                                                <dt className="text-gray-500">Idioma original</dt>
                                                <dd className="font-medium text-gray-900 text-right capitalize">
                                                    <span className="mr-1.5">{getLanguageFlag(work.originalLanguage)}</span>
                                                    {getLanguageName(work.originalLanguage)}
                                                </dd>
                                            </div>
                                        )}
                                        {/**
                                        {work.alternateNames && work.alternateNames.length > 0 && (
                                            <div className="pt-4 border-t border-gray-50 mt-4 space-y-3">
                                                {Object.entries(
                                                    sortAlternateNames(work.alternateNames).reduce((acc, alt) => {
                                                        const typeKey = alt.type || 'other';
                                                        if (!acc[typeKey]) acc[typeKey] = [];
                                                        acc[typeKey].push(alt);
                                                        return acc;
                                                    }, {} as Record<string, AlternateName[]>)
                                                ).sort((a, b) => getAlternateNamePriority(a[0]) - getAlternateNamePriority(b[0]))
                                                 .map(([type, names]) => (
                                                    <div key={type} className="bg-gray-50/50 rounded-lg p-2.5 border border-gray-100">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">
                                                            NOME ({getAlternateNameTypeName(type)})
                                                        </span>
                                                        <div className="space-y-1.5">
                                                            {names.map((alt, idx) => (
                                                                <div key={idx} className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-[13px] font-bold text-gray-800">
                                                                        {alt.value}
                                                                    </span>
                                                                    {(alt.language || alt.script) && (
                                                                        <span className="text-gray-400 font-medium text-[9px] bg-white px-1.5 py-0.5 rounded border border-gray-100 shadow-sm whitespace-nowrap">
                                                                            {[
                                                                                alt.language ? getLanguageName(alt.language) : '',
                                                                                alt.script ? getScriptName(alt.script, alt.language) : ''
                                                                            ].filter(Boolean).join(', ').toLowerCase()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        */}
                                        {work.ageRating && (
                                            <div className="flex justify-between items-center">
                                                <dt className="text-gray-500">Faixa etária</dt>
                                                <dd>
                                                    <div className={`w-8 h-6 rounded shrink-0 flex items-center justify-center font-bold text-white shadow-sm ${work.ageRating === 'L' ? 'bg-green-500' :
                                                        work.ageRating === '10' ? 'bg-sky-500' :
                                                            work.ageRating === '12' ? 'bg-yellow-400 text-yellow-900 border border-yellow-500' :
                                                                work.ageRating === '14' ? 'bg-orange-500' :
                                                                    work.ageRating === '16' ? 'bg-red-600' :
                                                                        work.ageRating === '18' ? 'bg-black' : 'bg-gray-400'
                                                        }`}>
                                                        {work.ageRating}
                                                    </div>
                                                </dd>
                                            </div>
                                        )}
                                        {work.seriesEntries && work.seriesEntries.length > 0 && (
                                            <div className="flex flex-col pt-2 mt-2 border-t border-gray-50">
                                                <dt className="text-gray-500 mb-1">Séries relacionadas</dt>
                                                <dd className="font-medium text-gray-900 flex flex-col gap-1">
                                                    {work.seriesEntries.map((series, idx) => (
                                                        series.seriesId ? (
                                                            <Link key={idx} to={PATHS.SERIES({ seriesId: series.seriesId })}
                                                                className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded text-xs font-semibold inline-block w-fit hover:bg-indigo-100 transition-colors">
                                                                {series.isPrimary && <span className="mr-1">⭐</span>}
                                                                {series.seriesName} <span className="opacity-70 font-normal">#{series.position}</span>
                                                            </Link>
                                                        ) : (
                                                            <span key={idx} className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded text-xs font-semibold inline-block w-fit">
                                                                {series.isPrimary && <span className="mr-1">⭐</span>}
                                                                {series.seriesName} <span className="opacity-70 font-normal">#{series.position}</span>
                                                            </span>
                                                        )
                                                    ))}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                </div>
                            )}

                            {/* Detalhes da Edição */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                                <h4 className="font-bold text-gray-900 mb-4">Detalhes da Edição</h4>
                                <dl className="space-y-3 text-sm">
                                    {edition.publisher?.name && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Editora</dt>
                                            <dd className="font-medium text-gray-900 text-right">{edition.publisher.name}</dd>
                                        </div>
                                    )}
                                    {edition.imprint?.name && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Selo</dt>
                                            <dd className="font-medium text-gray-900 text-right">{edition.imprint.name}</dd>
                                        </div>
                                    )}
                                    {edition.formatId && getFormatById(edition.formatId) && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Formato</dt>
                                            <dd className="font-medium text-gray-900 text-right flex items-center">
                                                <FormatIcon formatId={edition.formatId} />
                                                {getFormatById(edition.formatId)?.name}
                                            </dd>
                                        </div>
                                    )}
                                    {edition.pages && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Páginas</dt>
                                            <dd className="font-medium text-gray-900 text-right">{edition.pages}</dd>
                                        </div>
                                    )}
                                    {edition.duration && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Duração</dt>
                                            <dd className="font-medium text-gray-900 text-right">{edition.duration} min</dd>
                                        </div>
                                    )}
                                    {edition.dimensions && (edition.dimensions.height || edition.dimensions.width || edition.dimensions.thickness) && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Dimensões</dt>
                                            <dd className="font-medium text-gray-900 text-right">
                                                {[
                                                    edition.dimensions.width,
                                                    edition.dimensions.height,
                                                    edition.dimensions.thickness
                                                ]
                                                    .filter((val): val is number => val !== undefined && val !== null)
                                                    .map(val => val.toString().replace(/\./g, ','))
                                                    .join(' × ')} cm
                                            </dd>
                                        </div>
                                    )}
                                    {edition.weight && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Peso</dt>
                                            <dd className="font-medium text-gray-900 text-right">
                                                {edition.weight >= 1000
                                                    ? `${(edition.weight / 1000).toFixed(2).replace('.', ',')} kg`
                                                    : `${edition.weight} g`}
                                            </dd>
                                        </div>
                                    )}
                                    {edition.editionNumber && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Edição</dt>
                                            <dd className="font-medium text-gray-900 text-right">{edition.editionNumber}ª ed.</dd>
                                        </div>
                                    )}
                                    {edition.publicationDate && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">
                                                {isFutureDate(edition.publicationDate) ? 'Previsão de publicação' : 'Data de publicação'}
                                            </dt>
                                            <dd className="font-medium text-gray-900 text-right">{formatPublicationDate(edition.publicationDate)}</dd>
                                        </div>
                                    )}
                                    {edition.isbn13 && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">ISBN-13</dt>
                                            <dd className="font-medium text-gray-900 text-right">{formatISBN(edition.isbn13)}</dd>
                                        </div>
                                    )}
                                    {edition.isbn10 && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">ISBN-10</dt>
                                            <dd className="font-medium text-gray-900 text-right">{formatISBN(edition.isbn10)}</dd>
                                        </div>
                                    )}
                                    {edition.asin && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">ASIN</dt>
                                            <dd className="font-medium text-gray-900 text-right">{edition.asin}</dd>
                                        </div>
                                    )}
                                    {edition.language && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Idioma</dt>
                                            <dd className="font-medium text-gray-900 text-right capitalize">
                                                <span className="mr-1.5">{getLanguageFlag(edition.language)}</span>
                                                {getLanguageName(edition.language)}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </div>

                            {/* Classificações (Taxonomia) */}
                            {work && (work.genres?.length > 0 || work.themes?.length > 0 || work.locations?.length > 0) && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                                    <h4 className="font-bold text-gray-900 mb-4">Classificação</h4>
                                    <div className="space-y-4">
                                        {/* Gêneros */}
                                        {work.genres?.length > 0 && (
                                            <div>
                                                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Gêneros</h5>
                                                <div className="flex flex-wrap gap-2">
                                                    {work.genres.map((genre) => (
                                                        <span key={genre.id} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors cursor-pointer">
                                                            {genre.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {/* Temas */}
                                        {work.themes?.length > 0 && (
                                            <div>
                                                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Temas</h5>
                                                <div className="flex flex-wrap gap-2">
                                                    {work.themes.map((theme) => (
                                                        <span key={theme.id} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium border border-indigo-100 hover:bg-indigo-100 transition-colors cursor-pointer">
                                                            {theme.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {/* Local / Época */}
                                        {work.locations?.length > 0 && (
                                            <div>
                                                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Local ou Época</h5>
                                                <div className="flex flex-wrap gap-2">
                                                    {work.locations.map((location) => (
                                                        <span key={location.id} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium border border-emerald-100 hover:bg-emerald-100 transition-colors cursor-pointer">
                                                            {location.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
