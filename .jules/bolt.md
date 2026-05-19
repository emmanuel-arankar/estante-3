## 2024-05-19 - O(N) Message Grouping
**Learning:** In chat applications where messages are already sorted chronologically, grouping by day using `Array.prototype.find` on the groups array leads to O(N * D) complexity. This can be optimized to O(N) by only checking the last group.
**Action:** Always prefer checking the last element of a sorted list for grouping logic instead of searching the entire result set.
