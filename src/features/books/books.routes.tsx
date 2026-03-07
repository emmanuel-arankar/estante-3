import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { Book } from 'lucide-react';
import { bookDetailLoader } from '@/features/books/books.loaders';
import { ROUTE_PATTERNS } from '@/router/paths';
import { ErrorElement } from '@/router/ErrorElement';
import { withSuspense } from '@/router/RouteSuspense';

const BookDetail = lazy(() => import('@/features/books/pages/BookDetail').then(module => ({ default: module.BookDetail })));

export const booksRoutes: RouteObject[] = [
    {
        path: ROUTE_PATTERNS.BOOK_DETAIL,
        element: withSuspense(BookDetail),
        loader: bookDetailLoader,
        errorElement: <ErrorElement />,
        handle: {
            id: 'book-detail',
            breadcrumb: (data: any) => ({
                label: data?.edition?.title || 'Livro',
                icon: <Book className="h-4 w-4" />,
            }),
            title: (data: any) => `${data?.edition?.title || 'Detalhes do Livro'} | Estante de Bolso`,
        },
    },
];
