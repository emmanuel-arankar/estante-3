# 🔍 Auditoria Firestore — Estante-3

Análise de queries, índices e recomendações de otimização.

---

## 1. Mapa de Queries por Coleção

### `friendships` (maior volume — ~50 queries em `friends.ts`)

| Query Pattern | Campos | Usado em |
|---|---|---|
| `userId == X, status == 'accepted'` | `userId`, `status` | Listar amigos, contar mútuos |
| `userId == X, status == 'accepted', orderBy friend.nickname` | `userId`, `status`, `friend.nickname` | Lista ordenada por nick |
| `userId == X, status == 'accepted', orderBy friend.displayName` | `userId`, `status`, `friend.displayName` | Lista ordenada por nome |
| `userId == X, status == 'accepted', orderBy friendshipDate DESC` | `status`, `userId`, `friendshipDate` | Lista por data |
| `userId == X, status == 'accepted', orderBy updatedAt DESC` | `status`, `userId`, `updatedAt` | Lista por atividade |
| `userId == X, status == 'accepted', orderBy createdAt DESC` | `status`, `userId`, `createdAt` | Lista por criação |
| `friendId == X, status == 'pending', requestedBy == X` | `friendId`, `status`, `requestedBy` | Solicitações recebidas |
| `requestedBy == X, status == 'pending', userId == X` | `requestedBy`, `status`, `userId`, `createdAt` | Solicitações enviadas |

### `notifications`

| Query Pattern | Campos | Usado em |
|---|---|---|
| `userId == X, orderBy createdAt DESC` | `userId`, `createdAt` | Listar todas |
| `userId == X, read == false, orderBy createdAt DESC` | `userId`, `read`, `createdAt` | Listar não lidas |
| `userId == X, read == false` | `userId`, `read` | Contar não lidas |

### `users`

| Query Pattern | Campos | Usado em |
|---|---|---|
| `nickname == X` | `nickname` | Verificar disponibilidade de nick |
| `searchTerms array-contains X` | `searchTerms` | Buscar usuários por nome/nick (case-insensitive) |

> [!NOTE]
> A busca anterior por prefixo (`>= X, <= X\uf8ff`) foi **substituída** pela estratégia de N-Grams com `array-contains` no campo `searchTerms`. O campo é gerado automaticamente em `lib/search.ts` e atualizado sempre que o perfil é criado ou editado.

### `userAvatars`

| Query Pattern | Campos | Usado em |
|---|---|---|
| `userId == X, orderBy uploadedAt DESC` | `userId`, `uploadedAt` | Listar avatares |
| `userId == X, isCurrent == true` | `userId`, `isCurrent` | Avatar atual |

### `blocks`

| Query Pattern | Campos | Usado em |
|---|---|---|
| `blockerId == X, orderBy createdAt DESC` | `blockerId`, `createdAt` | Listar bloqueados |

---

## 2. Índices Definidos vs Utilizados

Total: **11 composite indexes** em `firestore.indexes.json`

| # | Coleção | Campos | Status |
|---|---|---|---|
| 1 | friendships | `friendId, status, requestedBy, __name__` | ✅ Usado (solicitações recebidas) |
| 2 | friendships | `requestedBy, status, userId, createdAt, __name__` | ✅ Usado (solicitações enviadas) |
| 3 | friendships | `status, userId, createdAt, __name__` | ✅ Usado (lista por data criação) |
| 4 | friendships | `status, userId, friendshipDate, __name__` | ✅ Usado (lista por data amizade) |
| 6 | friendships | `status, userId, requestedBy, __name__` | ✅ Usado (fallback sent requests) |
| 7 | friendships | `status, userId, updatedAt, __name__` | ✅ Usado (lista por atividade) |
| 8 | userAvatars | `userId, uploadedAt, __name__` | ✅ Usado (listar avatares) |
| 9 | friendships | `userId, status, friend.nickname` | ✅ Usado (ordenação nick) |
| 10 | friendships | `userId, status, friend.displayName` | ✅ Usado (ordenação nome) |
| 11 | notifications | `userId, read, createdAt` | ✅ Usado (notificações) |
| 12 | blocks | `blockerId, createdAt, __name__` | ✅ Usado (lista bloqueados) |

### Candidato a Remoção

> [!WARNING]
> **Índice #4** (`status, userId, createdAt, requestedBy, __name__`) pode ser redundante com **#3** (`status, userId, createdAt, __name__`). O Firestore pode usar #3 e filtrar `requestedBy` client-side. Porém, remover só deve ser feito com testes em produção — o índice pode existir para uma query com `orderBy` em `requestedBy`.

**Recomendação**: Manter por enquanto. Remover apenas após validar que nenhum endpoint depende da ordenação por `requestedBy DESC`.

---

## 3. Queries Potencialmente Lentas

### 🔴 Alta Prioridade

| Endpoint | Motivo | Recomendação |
|---|---|---|
| `POST /friendships/request` | Transaction com 6+ reads (users, friendships bidirecionais) | Já otimizado com transaction; monitorar latência |

### 🟡 Média Prioridade

| Endpoint | Motivo | Recomendação |
|---|---|---|
| `GET /notifications` | `orderBy createdAt, __name__` com cursor | Já otimizado com cursor-based pagination ✅ |
| `PATCH /notifications/mark-all-read` | Batch write de todas não lidas | Limitar batch size (máx 500 por vez) |
| `GET /friendships` com `search` | Filtra em memória (server-side) — busca todos os amigos sem `limit()` | Aceitável para listas pequenas de amigos; documentar limitação |

### 🟢 Já Otimizado

- Todas as listas usam `limit()` ✅
- Cursor-based pagination implementado ✅
- Busca de usuários usa `searchTerms array-contains` (N-Grams, case-insensitive) ✅
- `mutualFriendsCount` denormalizado no documento de friendship ✅
- `.select('friendId')` usado nas queries de mútuos para reduzir payload ✅

---

## 4. Recomendações de Otimização

### Curto Prazo — Concluídos ✅

1. ✅ **`mutualFriendsCount` denormalizado** — Salvo no doc de friendship; batch de propagação ao aceitar/remover
2. ✅ **`searchTerms` (N-Grams)** — Campo array gerado em `lib/search.ts`, busca via `array-contains`
3. ✅ **Cache Redis/in-memory** — Implementado nos endpoints de listagem

### Médio Prazo

4. ✅ **Composite index cleanup** — Índice redundante #4 removido (confirmado que nenhuma query usa `requestedBy` como campo de ordenação)
5. **Monitoramento** — Usar log-based metrics para identificar queries >500ms automaticamente
6. **Busca full-text avançada** — Para escala futura, considerar Algolia (o `searchTerms` atual cobre bem os casos de uso presentes)

---

## 5. Índices Faltantes

Nenhum índice faltante identificado. Todas as queries compostas têm índice correspondente.

> [!TIP]
> Se o Firestore retornar erros de índice em produção, os logs terão um link direto para criar o índice automaticamente.
