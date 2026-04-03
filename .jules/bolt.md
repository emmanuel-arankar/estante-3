# Bolt's Performance Journal

## 2026-04-03 - [Ref-based progress tracking for event listeners]
**Learning:** Using `useCallback` for event handlers that depend on high-frequency state (like `dragProgress`) causes the `useEffect` managing global listeners to re-attach on every state update. This negates the performance benefit and can cause jitter.
**Action:** Use `useRef` to store the high-frequency value and access it inside the `useCallback`. This keeps the callback identity stable and prevents `useEffect` churn.

## 2026-04-03 - [Single-pass Grouping for Sorted Data]
**Learning:** When grouping chronologically sorted data (like chat messages), a single-pass O(N) algorithm that only checks the last group is significantly more efficient than using `.find()` or `.filter()`, which can lead to O(N*G) or O(N^2) complexity.
**Action:** Always prefer single-pass grouping for time-series or sorted datasets.
