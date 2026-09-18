## 2026-09-18 - [Chat Media Overlays Memoization & Filtering]
**Learning:** `ChatGallery` and `MediaViewer` components re-rendered on every state update in parent chat views (such as message streaming or typing input). `ChatGallery` executed array `.filter()` with regex operations over chat history on every render.
**Action:** Wrap modal/drawer overlays in `React.memo` with explicit `displayName`s and memoize internal array derivations using `useMemo` dependent on `[messages, isOpen]`.
