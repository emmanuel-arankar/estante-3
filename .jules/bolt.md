## 2026-09-23 - Lazy Loading Heavy Emoji Datasets and Memoizing Chat Input Controls

**Learning:** Heavy static data modules like `@emoji-mart/data` (~500KB JSON) included via top-level static imports inflate initial bundle sizes and increase module execution overhead for chat routes even when emoji pickers remain unopened. Combining `React.lazy` for on-demand loading of emoji picker assets with `React.memo` on key input components prevents redundant re-renders when parent chat page state (such as scrolling, online indicators, and incoming message polling) updates.

**Action:** Dynamically import heavy UI widgets and static datasets on popover/modal open, and memoize input controls using `React.memo` along with `useCallback` for parent event handlers.
