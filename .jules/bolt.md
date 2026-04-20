## 2026-04-20 - [Performance] O(N*G) Message Grouping in Chat
**Learning:** The chat message grouping logic used `groups.find()`, resulting in O(N*G) complexity. In a chat application, messages are chronologically sorted, making it more efficient to only check the last group created.
**Action:** Use a single-pass O(N) approach by comparing current items only with the tail of the groups array when dealing with sorted datasets.

## 2026-04-20 - [CI] Backend Test Mock Completeness
**Learning:** Vitest mocks for ESM modules must explicitly export all functions used by the code under test, even if they are optional or used in other routes (like `checkAuthOptional`). Failure to do so leads to obscure import errors in unrelated tests.
**Action:** Ensure all exports of a mocked module are accounted for in the `vi.mock` factory.
