import { useLoaderData } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Edition } from '@estante/common-types';
import { editionQuery, workQuery } from '@/features/books/books.queries';
import { PageMetadata } from '@/components/seo/PageMetadata';

export const BookDetail = () => {
    const { edition: initialEdition } = useLoaderData() as { edition: Edition };

    // React Query mantém os dados sincronizados
    const { data: edition } = useQuery({
        ...editionQuery(initialEdition.id),
        initialData: initialEdition,
    });

    // Carregar Work Details se existir (prefetch feito no loader)
    useQuery({
        ...workQuery(edition.workId),
        enabled: !!edition.workId,
    });

    if (!edition) return null;

    // Gerar SEO
    const seoTitle = `${edition.title} ${edition.subtitle ? `- ${edition.subtitle}` : ''} | Estante de Bolso`;
    const seoDesc = edition.description?.slice(0, 150) || 'Detalhes do livro na Estante de Bolso.';

    return (
        <>
            <PageMetadata
                title={seoTitle}
                description={seoDesc}
            />

            <div className="min-h-screen bg-gray-50 pb-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

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

                                {/* Shelf Button Placeholder */}
                                <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                                    Adicionar à Estante
                                </button>

                                {/* Rating Widget Placeholder */}
                                <div className="mt-6 pt-6 border-t border-gray-100">
                                    <p className="text-sm font-medium text-gray-700 mb-2 text-center">Sua Avaliação</p>
                                    <div className="flex justify-center gap-1 text-gray-300">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <span key={star} className="text-2xl cursor-pointer hover:text-yellow-400">★</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Centro: Informações Principais */}
                        <div className="lg:col-span-6">
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                    {edition.title}
                                </h1>
                                {edition.subtitle && (
                                    <h2 className="text-xl text-gray-600 mb-4">{edition.subtitle}</h2>
                                )}

                                <div className="flex flex-wrap items-center gap-2 mb-6 text-indigo-600 font-medium">
                                    {edition.contributors.filter(c => c.role === 'author' || c.role === 'co-author').map((author, index) => (
                                        <span key={author.personId || author.groupId || index}>
                                            {author.name} {index < edition.contributors.length - 1 ? ',' : ''}
                                        </span>
                                    ))}
                                </div>

                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 border-b border-gray-100 pb-6">
                                    <div className="flex items-center gap-1 text-yellow-500">
                                        <span className="text-lg">★</span>
                                        <span className="font-bold text-gray-900">{edition.averageRating?.toFixed(2) || '0.00'}</span>
                                        <span className="text-gray-500 ml-1">({edition.ratingsCount || 0} avaliações)</span>
                                    </div>
                                    {edition.pages && (
                                        <div className="flex items-center gap-1">
                                            <span>{edition.pages} páginas</span>
                                        </div>
                                    )}
                                </div>

                                <div className="prose prose-indigo max-w-none text-gray-700">
                                    <h3 className="text-lg font-bold text-gray-900 mb-3">Sinopse</h3>
                                    {/* eslint-disable-next-line react/no-danger */}
                                    <div dangerouslySetInnerHTML={{ __html: edition.description || '<p>Nenhuma sinopse disponível.</p>' }} />
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

                            {/* Detalhes da Edição */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                                <h4 className="font-bold text-gray-900 mb-4">Detalhes da Edição</h4>
                                <dl className="space-y-3 text-sm">
                                    {edition.publisherName && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Editora</dt>
                                            <dd className="font-medium text-gray-900 text-right">{edition.publisherName}</dd>
                                        </div>
                                    )}
                                    {edition.publicationDate && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Publicação</dt>
                                            <dd className="font-medium text-gray-900 text-right">{edition.publicationDate}</dd>
                                        </div>
                                    )}
                                    {edition.isbn13 && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">ISBN-13</dt>
                                            <dd className="font-medium text-gray-900 text-right">{edition.isbn13}</dd>
                                        </div>
                                    )}
                                    {edition.language && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Idioma</dt>
                                            <dd className="font-medium text-gray-900 text-right capitalize">{edition.language}</dd>
                                        </div>
                                    )}
                                </dl>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
