export * from './auth/auth.routes';
export * from './books/books.routes';
export * from './chat/chat.routes';
// NOTE: Curatorship routes are intentionally NOT exported here to preserve route-level code splitting.
// They are dynamically imported on demand via `lazy: () => import('@/features/curatorship/curatorship.routes')`
// in `src/router/routes.tsx`. Statically re-exporting here would defeat lazy loading and bloat the initial bundle.
export * from './friends/friends.routes';
export * from './profile/profile.routes';
