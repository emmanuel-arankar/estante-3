## 2026-05-23 - [Memoização em Listas de Amigos]
**Learning:** O componente `DenormalizedFriendsList` renderiza listas que podem ser longas e sofrer re-renders frequentes devido a mudanças no `searchQuery`. A falta de memoização nos sub-componentes (cards e itens de lista) resultava em O(N) re-renderizações desnecessárias.
**Action:** Aplicar `React.memo` em todos os componentes de item de lista e sub-componentes de UI no diretório `src/components/friends/`, garantindo que os handlers passados (como `mutateAsync` do TanStack Query) sejam referencialmente estáveis.
