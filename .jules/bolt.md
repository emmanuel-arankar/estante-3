## 2026-05-06 - [Chat Message List Re-render Optimization]
**Learning:** Memoization of large lists (e.g., `ChatBubble` in `src/pages/Chat.tsx`) is invalidated by even a single inline closure in the parent's render loop. Passing stable handlers wrapped in `useCallback` and designing child components to pass their own identifiers back to these handlers ensures referential stability and prevents O(N) re-renders during frequent state changes like search input or typing indicators.
**Action:** Always wrap list item components in `React.memo()` and ensure all callback props are referentially stable. Design callbacks to accept IDs from the child rather than creating closures in the render loop.

## 2026-05-06 - [Audio Player Waveform Recalculation]
**Learning:** High-frequency UI updates, such as dragging a seek bar or playback progress, trigger component re-renders. If these components contain O(N) data transformations (like filtering a waveform array for display), they become a bottleneck.
**Action:** Use `useMemo()` for any data transformation within high-frequency UI components, even if the input data seems small, to ensure smooth interactions (60fps).
