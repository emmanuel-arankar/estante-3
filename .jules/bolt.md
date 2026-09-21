## 2026-09-21 - Debounced Effects with Initial Mount Duplicate Fetches

**Learning:** When a component has both an immediate `useEffect([], ...)` for initial data loading and a debounced `useEffect([query], ...)` for search, the debounced effect also fires on initial render (since `query` is `''`). This creates a duplicate API fetch after the debounce timeout.
**Action:** Use an `isInitialMount` ref (`useRef(true)`) inside the debounced search effect to skip execution on initial render and prevent redundant network calls on component mount.
