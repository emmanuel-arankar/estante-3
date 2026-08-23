## 2026-08-23 - High-Frequency Animation Frame Audio Player Optimization

**Learning:** Audio player components executing `requestAnimationFrame` render loops (60-120fps) cause inline array operations (such as `Array.from()` or `.filter()`) to allocate memory and trigger garbage collection every single frame during playback.

**Action:** Always wrap waveform bar computations and array derivations in `useMemo` dependent on the `waveform` prop, and memoize the player sub-components (`AudioPlayer`, `ChatBubble`) using `React.memo` to eliminate redundant frame calculations and prevent re-rendering during playback.
