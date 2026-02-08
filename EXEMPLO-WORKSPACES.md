# 📘 Exemplo Prático: Como Usar Workspaces

Este é um guia passo a passo mostrando **quando** e **como** modificar o `packages/common-types`.

---

## 🎯 Cenário: Adicionar campo "isOnline" aos usuários

Você quer mostrar se um usuário está online no chat.

---

## 📝 Passo a Passo Completo

### **Passo 1: Editar o modelo compartilhado**

**O que fazer:** Adicionar o novo campo à interface `User`

**Onde:** `packages/common-types/src/user.model.ts`

**Antes:**
```typescript
export interface User {
  id: string;
  email: string;
  displayName: string;
  nickname: string;
  photoURL?: string;
  // ... outros campos ...
  updatedAt: Date;
}
```

**Depois:**
```typescript
export interface User {
  id: string;
  email: string;
  displayName: string;
  nickname: string;
  photoURL?: string;
  // ... outros campos ...
  updatedAt: Date;
  isOnline?: boolean;        // ⬅️ NOVO CAMPO ADICIONADO
  lastSeenAt?: Date;         // ⬅️ OPCIONAL: quando foi visto pela última vez
}
```

---

### **Passo 2: Compilar os tipos**

**Por que?** TypeScript precisa compilar `.ts` → `.js` + `.d.ts` para ser usado

**Como:**
```bash
# Na raiz do projeto
npm run build:common

# Ou diretamente no pacote
cd packages/common-types
npm run build
```

**O que acontece:**
```
packages/common-types/
├── src/
│   └── user.model.ts          ⬅️ Arquivo que você editou
└── dist/
    ├── user.model.js          ⬅️ Compilado JavaScript
    └── user.model.d.ts        ⬅️ Tipos TypeScript (para IDE)
```

---

### **Passo 3: Usar no Backend**

**Arquivo:** `backend-api/src/auth.ts` (ou qualquer arquivo backend)

**Como usar:**
```typescript
import { User } from '@estante/common-types';  // ⬅️ Importa do workspace

// Agora você pode usar o novo campo
const user: User = {
  id: 'abc123',
  email: 'user@example.com',
  displayName: 'João Silva',
  nickname: 'joao',
  isOnline: true,           // ⬅️ NOVO CAMPO disponível!
  lastSeenAt: new Date(),   // ⬅️ TypeScript autocompleta!
  // ... outros campos
};

// Salvar no Firestore
await db.collection('users').doc(user.id).set(user);
```

**Vantagens:**
- ✅ TypeScript **autocompleta** o novo campo
- ✅ TypeScript **valida** se você esqueceu campos obrigatórios
- ✅ Se você digitar errado (`isOnlune`), TypeScript **avisa o erro**

---

### **Passo 4: Usar no Frontend**

**Arquivo:** `src/components/chat/ChatMessage.tsx` (ou qualquer componente)

**Como usar:**
```typescript
import { User } from '@estante/common-types';  // ⬅️ Mesma importação!

interface ChatMessageProps {
  user: User;
  message: string;
}

export function ChatMessage({ user, message }: ChatMessageProps) {
  return (
    <div>
      <img src={user.photoURL} alt={user.displayName} />
      <span>{user.displayName}</span>

      {/* ⬅️ NOVO: Mostrar indicador online */}
      {user.isOnline && (
        <span className="online-indicator">🟢 Online</span>
      )}

      <p>{message}</p>
    </div>
  );
}
```

**Vantagens:**
- ✅ **Mesmo tipo** usado no backend e frontend
- ✅ Se backend mudar o tipo, frontend **automaticamente** sabe
- ✅ **Não há dessincronia** entre backend e frontend

---

## 🔄 Fluxo Completo Ilustrado

```
┌─────────────────────────────────────────────────────────────┐
│  1. VOCÊ EDITA                                              │
│  packages/common-types/src/user.model.ts                    │
│                                                             │
│  + isOnline?: boolean;                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. VOCÊ COMPILA                                            │
│  npm run build:common                                       │
│                                                             │
│  Gera: dist/user.model.js + dist/user.model.d.ts           │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────┴───────┐
                    ↓               ↓
┌─────────────────────────┐   ┌──────────────────────────┐
│  3. BACKEND USA         │   │  3. FRONTEND USA         │
│  backend-api/src/*.ts   │   │  src/components/*.tsx    │
│                         │   │                          │
│  import { User }        │   │  import { User }         │
│  from '@estante/        │   │  from '@estante/         │
│       common-types'     │   │       common-types'      │
│                         │   │                          │
│  ✅ Vê isOnline         │   │  ✅ Vê isOnline          │
│  ✅ Autocomplete        │   │  ✅ Autocomplete         │
│  ✅ Type checking       │   │  ✅ Type checking        │
└─────────────────────────┘   └──────────────────────────┘
```

---

## 🎨 Mais Exemplos Práticos

### Exemplo 2: Adicionar novo tipo de notificação

**1. Editar:** `packages/common-types/src/notification.model.ts`
```typescript
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'like'
  | 'comment'
  | 'mention'
  | 'new_message';      // ⬅️ NOVO tipo
```

**2. Compilar:** `npm run build:common`

**3. Usar no backend e frontend:**
```typescript
import { NotificationType } from '@estante/common-types';

// Backend
const notification = {
  type: 'new_message' as NotificationType,  // ⬅️ TypeScript valida!
  userId: 'abc123',
  content: 'Nova mensagem no chat'
};

// Frontend
if (notification.type === 'new_message') {
  // TypeScript sabe que é válido
  showChatNotification(notification);
}
```

---

### Exemplo 3: Modificar estrutura existente

**Cenário:** Você quer mudar `location` de string para objeto estruturado

**1. Editar:** `packages/common-types/src/user.model.ts`
```typescript
// ANTES
export interface User {
  location?: string;  // Ex: "São Paulo, SP"
}

// DEPOIS
export interface User {
  location?: UserLocation;  // Estruturado com city, state, stateCode
}

export interface UserLocation {
  city: string;
  state: string;
  stateCode: string;
}
```

**2. Compilar:** `npm run build:common`

**3. TypeScript avisa TODOS os lugares que precisam mudar:**
```typescript
// ❌ ERRO: TypeScript detecta uso antigo
const user: User = {
  location: "São Paulo, SP"  // ❌ Tipo errado!
};

// ✅ CORRETO: TypeScript valida novo formato
const user: User = {
  location: {
    city: "São Paulo",
    state: "São Paulo",
    stateCode: "SP"
  }
};
```

---

## ✅ Quando Editar `packages/common-types`

### ✅ SIM, edite quando:
- Adicionar novo campo a User, Post, Friendship, etc.
- Criar novo modelo (ex: `Message`, `Review`)
- Modificar tipos existentes
- Adicionar validações Zod compartilhadas
- Criar enums/constants compartilhados

### ❌ NÃO, não edite quando:
- Adicionar componente React (vai em `src/components/`)
- Adicionar lógica de negócio (vai em `src/services/` ou `backend-api/src/`)
- Adicionar rotas/endpoints (vai em `backend-api/src/`)
- Estilizar UI (vai em `src/` com Tailwind/CSS)

---

## 🎯 Resumo

**O que é:** `packages/common-types` = **Tipos compartilhados** entre frontend e backend

**Quando usar:** Sempre que precisar **definir estrutura de dados** usada em ambos

**Fluxo:**
1. Edita em `packages/common-types/src/`
2. Compila com `npm run build:common`
3. Usa automaticamente no frontend e backend via `import { Tipo } from '@estante/common-types'`

**Vantagem:**
- ✅ **Uma única fonte de verdade** para os tipos
- ✅ **Sincronização automática** entre frontend e backend
- ✅ **TypeScript valida** tudo automaticamente
- ✅ **Mesma abordagem** de grandes empresas

---

## 🤔 Dúvidas Comuns

**Q: E se eu só mudar no frontend sem atualizar common-types?**
A: O backend não vai saber do novo campo, pode causar bugs.

**Q: E se eu só mudar no backend sem atualizar common-types?**
A: O frontend não vai ter o tipo, TypeScript vai dar erro.

**Q: Preciso reiniciar servidores depois de compilar common-types?**
A:
- Backend standalone: **SIM**, reinicie `npm run dev` no backend-api
- Frontend: **Geralmente não**, Vite detecta mudanças automaticamente
- Emuladores: **SIM**, reinicie `firebase emulators:start`

**Q: Posso ter tipos só no frontend ou só no backend?**
A: **SIM!** Tipos específicos de frontend vão em `src/types/`, tipos de backend em `backend-api/src/types/`. O `common-types` é só para tipos **compartilhados**.

