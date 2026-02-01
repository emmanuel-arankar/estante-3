import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import {
  QueryClientProvider,
  HydrationBoundary
} from '@tanstack/react-query';
import { appRouter } from '@/router';
import { queryClient } from '@/lib/queryClient';
import { PresenceManager } from '@/components/common/PresenceManager';
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext';
import './index.css';

ReactDOM.hydrateRoot(
  document.getElementById('root')!,
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <HydrationBoundary state={(window as any).__DEHYDRATED_STATE__}>
          <AudioPlayerProvider>
            <PresenceManager>
              <RouterProvider router={appRouter} />
            </PresenceManager>
          </AudioPlayerProvider>
        </HydrationBoundary>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);