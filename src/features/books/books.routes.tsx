import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { Book, Users, User, Layers, List } from 'lucide-react';
import { bookDetailLoader } from '@/features/books/books.loaders';
import { ROUTE_PATTERNS } from '@/router/paths';
import { ErrorElement } from '@/router/ErrorElement';
import { withSuspense } from '@/router/RouteSuspense';

const BookPage = lazy(() => import('@/features/books/pages/BookPage').then(module => ({ default: module.BookPage })));
const WorkRedirect = lazy(() => import('@/features/books/pages/WorkRedirect').then(module => ({ default: module.WorkRedirect })));
const PersonPage = lazy(() => import('@/features/books/pages/PersonPage').then(module => ({ default: module.PersonPage })));
const GroupPage = lazy(() => import('@/features/books/pages/GroupPage').then(module => ({ default: module.GroupPage })));
const EditionsPage = lazy(() => import('@/features/books/pages/EditionsPage').then(module => ({ default: module.EditionsPage })));
const SeriesPage = lazy(() => import('@/features/books/pages/SeriesPage').then(module => ({ default: module.SeriesPage })));

export const booksRoutes: RouteObject[] = [
    {
        path: ROUTE_PATTERNS.BOOK_PAGE,
        element: withSuspense(BookPage),
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
        path: ROUTE_PATTERNS.AUTHOR_PAGE,
        element: withSuspense(PersonPage),
        errorElement: <ErrorElement />,
        handle: {
            id: 'author-detail',
            breadcrumb: (data: any) => ({
                label: data?.name || 'Autor',
                icon: <User className="h-4 w-4" />,
            }),
            title: () => 'Detalhes do Autor | Estante de Bolso',
        },
    },
    {
        path: ROUTE_PATTERNS.GROUP_PAGE,
        element: withSuspense(GroupPage),
        errorElement: <ErrorElement />,
        handle: {
            id: 'group-detail',
            breadcrumb: (data: any) => ({
                label: data?.name || 'Grupo',
                icon: <Users className="h-4 w-4" />,
            }),
            title: () => 'Grupo de Autores | Estante de Bolso',
        },
    },
    {
        path: ROUTE_PATTERNS.WORK_EDITIONS,
        element: withSuspense(EditionsPage),
        errorElement: <ErrorElement />,
        handle: {
            id: 'editions-page',
            breadcrumb: (data: any) => ({
                label: 'Edições',
                icon: <Layers className="h-4 w-4" />,
            }),
            title: () => 'Todas as Edições | Estante de Bolso',
        },
    },
    {
        path: ROUTE_PATTERNS.SERIES_PAGE,
        element: withSuspense(SeriesPage),
        errorElement: <ErrorElement />,
        handle: {
            id: 'series-detail',
            breadcrumb: () => ({
                label: 'Série',
                icon: <List className="h-4 w-4" />,
            }),
            title: () => 'Série | Estante de Bolso',
        },
    },
];
