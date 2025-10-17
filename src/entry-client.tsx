import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClientProvider, HydrationBoundary } from '@tanstack/react-query'; // # atualizado
import { appRouter } from './router';
import { queryClient } from './lib/queryClient';
import './index.css';

ReactDOM.hydrateRoot(
  document.getElementById('root')!,
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <HydrationBoundary state={(window as any).__DEHYDRATED_STATE__}>
          <RouterProvider router={appRouter} />
        </HydrationBoundary>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);