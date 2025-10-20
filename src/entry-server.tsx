import React from 'react';
import { renderToPipeableStream, PipeableStream } from 'react-dom/server';
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from 'react-router-dom/server';
import { QueryClientProvider, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { routes } from './router/routes';
import { queryClient as client } from './lib/queryClient';

// # atualizado: Exportamos o queryClient para ser usado na Cloud Function
export const queryClient = client;

interface RenderOptions {
  onShellReady: (stream: PipeableStream) => void;
  onAllReady: () => void;
  onError: (error: unknown) => void;
}

export async function render(request: Request, options: RenderOptions) {
  queryClient.clear();

  const handler = createStaticHandler(routes);
  const context = await handler.query(request);

  if (context instanceof Response) {
    // Se o loader já retornou um redirect, lançamos a resposta
    // para ser capturada pelo handler da Cloud Function.
    throw context;
  }

  const router = createStaticRouter(handler.dataRoutes, context);
  const helmetContext = {};

  const stream = renderToPipeableStream(
    <React.StrictMode>
      <HelmetProvider context={helmetContext}>
        <QueryClientProvider client={queryClient}>
          <HydrationBoundary state={dehydrate(queryClient)}>
            <StaticRouterProvider router={router} context={context} />
          </HydrationBoundary>
        </QueryClientProvider>
      </HelmetProvider>
    </React.StrictMode>,
    {
      onShellReady() {
        options.onShellReady(stream);
      },
      onAllReady() {
        options.onAllReady();
      },
      onError(error) {
        options.onError(error);
      },
    }
  );

  return { helmetContext };
}