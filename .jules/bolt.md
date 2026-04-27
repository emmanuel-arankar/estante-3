## 2025-05-14 - O(N) Chat Message Grouping
**Learning:** Grouping chronologically sorted data (like chat messages by date) using `.find()` inside a loop creates an O(N*G) bottleneck. Since the data is already sorted, we only ever need to check the last group created to decide whether to append to it or start a new one.
**Action:** Always leverage data sorting to implement single-pass O(N) grouping or filtering algorithms instead of nested searches.
