## 2025-03-10 - [Instant Avatar Rendering]
**Learning:** Initializing state with a lazy initializer that checks a synchronous cache (like a Map) allows React components to skip the "loading" state entirely during the first render if data is already available. This eliminates flicker and improves perceived performance significantly more than just `React.memo`.
**Action:** Always check synchronous caches during state initialization to provide an "instant" UI for cached resources.
