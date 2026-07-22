# Bolt's Journal - Performance Learnings

## 2026-07-22 - [Hero component animated background jitter]
**Learning:** Using `Math.random()` in render paths for animations leads to visual jitter and high CPU overhead during re-renders, especially when tied to interactive elements like typing inside a search text input field.
**Action:** Always wrap dynamically generated coordinates/animation properties in `useMemo` with an empty dependency array (or other appropriate dependencies) to guarantee stable, persistent coordinates across keypress-induced re-renders.
