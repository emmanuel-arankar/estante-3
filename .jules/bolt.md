## 2024-05-24 - [Stable Interaction Patterns for High-Frequency State]
**Learning:** When implementing complex interactive components like an `AudioPlayer` with drag-to-seek, tracking the immediate "progress" in React state causes high-frequency re-renders that can break stable `useCallback` references if they are used as effect dependencies. Using a `useRef` to hold the immediate interaction state while only syncing to React state on `interactionEnd` preserves referential stability of callbacks and prevents "effect cycling".
**Action:** Use `useRef` for high-frequency UI state (drags, mouse moves) and only promote to React state when necessary for other parts of the UI to sync.

## 2024-05-24 - [Single-Pass Grouping for Sorted Data]
**Learning:** Even with relatively small datasets (100-500 items), O(N^2) or O(N*G) grouping logic in the render path (e.g., using `.find()` inside a loop to group messages by date) can cause noticeable frame drops during scrolls or updates.
**Action:** Leverage the natural sort order of the data (e.g., messages sorted by `createdAt`) to implement a single-pass O(N) grouping algorithm that only compares the current item with the tail of the last group.
