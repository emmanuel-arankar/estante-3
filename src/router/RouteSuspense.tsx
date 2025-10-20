import { Suspense, ElementType } from 'react';
import { LoadingSpinner } from '../components/ui/loading-spinner';

const RouteFallback = () => (
  <div className="flex h-[calc(100vh-10rem)] w-full items-center justify-center">
    <LoadingSpinner size="lg" />
  </div>
);

export const withSuspense = (Component: ElementType) => (
  <Suspense fallback={<RouteFallback />}>
    <Component />
  </Suspense>
);