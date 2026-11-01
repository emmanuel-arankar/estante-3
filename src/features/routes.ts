export * from './auth/auth.routes';
export * from './books/books.routes';
export * from './chat/chat.routes';
// curatorship.routes is omitted here intentionally to avoid pulling the curatorship
// dashboard bundle into the main entry bundle via barrel imports. It is loaded
// dynamically on-demand via `lazy: () => import('@/features/curatorship/curatorship.routes')` in routes.tsx.
export * from './friends/friends.routes';
export * from './profile/profile.routes';
