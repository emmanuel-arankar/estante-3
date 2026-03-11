import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { Book } from 'lucide-react';
import { bookDetailLoader } from '@/features/books/books.loaders';
import { ROUTE_PATTERNS } from '@/router/paths';
import { ErrorElement } from '@/router/ErrorElement';
import { withSuspense } from '@/router/RouteSuspense';

const BookDetail = lazy(() => import('@/features/books/pages/BookDetail').then(module => ({ default: module.BookDetail })));
const WorkRedirect = lazy(() => import('@/features/books/pages/WorkRedirect').then(module => ({ default: module.WorkRedirect })));
const PersonDetail = lazy(() => import('@/features/books/pages/PersonDetail').then(module => ({ default: module.PersonDetail })));
const GroupDetail = lazy(() => import('@/features/books/pages/GroupDetail').then(module => ({ default: module.GroupDetail })));

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
    {
        path: ROUTE_PATTERNS.WORK_REDIRECT,
        element: withSuspense(WorkRedirect),
        errorElement: <ErrorElement />,
        handle: {
            id: 'work-redirect',
            title: () => 'Carregando Obra | Estante de Bolso',
        },
    },
    {
        path: ROUTE_PATTERNS.AUTHOR_DETAIL,
        element: withSuspense(PersonDetail),
        errorElement: <ErrorElement />,
        handle: {
            id: 'author-detail',
            title: () => 'Detalhes do Autor | Estante de Bolso',
        },
    },
    {
        path: ROUTE_PATTERNS.GROUP_DETAIL,
        element: withSuspense(GroupDetail),
        errorElement: <ErrorElement />,
        handle: {
            id: 'group-detail',
            title: () => 'Grupo de Autores | Estante de Bolso',
        },
    },
];
