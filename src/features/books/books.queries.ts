import { queryOptions } from '@tanstack/react-query';
import { getWorkAPI, getEditionAPI, checkIsbnAPI, getPublisherAPI, getPersonAPI } from '@/features/books/services/booksApi';

export const workQuery = (workId: string) => queryOptions({
  queryKey: ['works', workId],
  queryFn: () => getWorkAPI(workId),
  staleTime: 1000 * 60 * 5, // 5 minutos
});

export const editionQuery = (editionId: string) => queryOptions({
  queryKey: ['editions', editionId],
  queryFn: () => getEditionAPI(editionId),
  staleTime: 1000 * 60 * 5, // 5 minutos
});

export const publisherQuery = (publisherId: string) => queryOptions({
  queryKey: ['publishers', publisherId],
  queryFn: () => getPublisherAPI(publisherId),
  staleTime: 1000 * 60 * 5, // 5 minutos
});

export const authorQuery = (personId: string) => queryOptions({
  queryKey: ['persons', personId],
  queryFn: () => getPersonAPI(personId),
  staleTime: 1000 * 60 * 5, // 5 minutos
});

export const checkIsbnQuery = (isbn: string) => queryOptions({
  queryKey: ['isbn-check', isbn],
  queryFn: () => checkIsbnAPI(isbn),
  staleTime: 1000 * 60 * 60, // 1 hora
});
