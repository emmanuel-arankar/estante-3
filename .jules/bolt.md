## 2026-03-20 - [Efficient Message Grouping & Clean Environment]
**Learning:** For chronologically sorted datasets like chat messages, grouping by date can be optimized from O(N*G) to O(N) by only comparing with the tail of the groups array. Additionally, running validation commands in the sandbox may modify `package-lock.json` due to environment mismatches; these must be reverted before submission to maintain a clean patch.
**Action:** Use single-pass checks for sorted groups. Always check for and revert unintentional `package-lock.json` modifications before commit.
