# Bolt's Performance Journal

## 2026-11-11 - Route Barrel Re-exports Breaking Vite Code Splitting
**Learning:** Re-exporting route modules (e.g., `export * from './curatorship/curatorship.routes'`) in a centralized barrel file (`src/features/routes.ts`) that is imported statically by `src/router/routes.tsx` causes Vite/Rollup to statically include all exported components and their dependency subtrees in the entry chunk, completely defeating `lazy: () => import(...)` route splitting. Vite emits a warning: `"(...) is dynamically imported by (...) but also statically imported by (...), dynamic import will not move module into another chunk."`
**Action:** When using route-level lazy loading in React Router / Vite, ensure route definitions intended for lazy loading are never re-exported through barrel files that are imported statically by the router.
