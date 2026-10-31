export * from './auth/auth.routes';
export * from './books/books.routes';
export * from './chat/chat.routes';
// Curatorship routes are lazy-loaded dynamically in src/router/routes.tsx.
// Do not statically re-export curatorship.routes here to preserve code splitting and bundle isolation.
export * from './friends/friends.routes';
export * from './profile/profile.routes';
