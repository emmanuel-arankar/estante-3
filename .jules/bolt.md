## 2026-03-30 - Optimized Chat Message Grouping
**Learning:** For chronologically sorted datasets (like chat messages), grouping by date using `groups.find()` inside a loop results in unnecessary O(N*G) complexity. Since the data is already sorted, we can achieve O(N) by only comparing each item with the last group created.
**Action:** Always prefer single-pass tail-comparison for grouping sorted chronological data.
