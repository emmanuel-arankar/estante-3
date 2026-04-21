## 2025-05-15 - [O(N) Message Grouping]
**Learning:** Grouping chronologically sorted datasets (like chat messages) using `.find()` or `.findIndex()` on the result array leads to redundant (N \cdot G)$ complexity where $ is the number of groups.
**Action:** Implement a single-pass O(N) grouping algorithm by only comparing the current item with the last group in the result array, taking advantage of the sorted nature of the source data.
