## 2026-04-12 - Memoização de Árvore de Comentários
**Learning:** Em componentes com entradas de texto frequentes (como o `ReviewComments`), o recálculo de estruturas de dados complexas (O(N) para construção da árvore e O(N log N) para ordenação) no corpo do componente causa lentidão ao digitar.
**Action:** Sempre usar `useMemo` para estabilizar transformações de dados baseadas em props ou queries de rede, garantindo que o re-render por estado local (como `newComment`) seja barato.
