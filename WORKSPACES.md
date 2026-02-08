# 📦 NPM Workspaces - @estante/common-types

Este projeto usa **NPM Workspaces** para gerenciar o pacote compartilhado `@estante/common-types`. Esta é a **melhor prática** adotada por grandes projetos (React, Next.js, Turborepo, Vercel, etc.).

---

## 🎯 O que são Workspaces?

Workspaces permitem gerenciar múltiplos pacotes dentro de um único repositório (monorepo) de forma eficiente:

- ✅ **Links simbólicos automáticos** entre pacotes
- ✅ **Hoisting de dependências** compartilhadas
- ✅ **Mudanças refletidas instantaneamente** sem rebuild
- ✅ **Melhor performance** do que usar tarballs (.tgz)
- ✅ **Usado por grandes empresas** (Google, Meta, Vercel, etc.)

---

## 📁 Estrutura do Projeto

```
estante-3/
├── packages/
│   └── common-types/          # Tipos compartilhados
│       ├── src/
│       │   ├── user.model.ts
│       │   ├── friendship.model.ts
│       │   ├── post.model.ts
│       │   ├── chat.model.ts
│       │   └── index.ts
│       ├── dist/              # Compilado TypeScript
│       ├── package.json       # @estante/common-types
│       └── tsconfig.json
│
├── backend-api/               # Backend API (workspace)
│   ├── src/
│   └── package.json           # Depende de @estante/common-types
│
├── src/                       # Frontend (workspace raiz)
│   └── ...                    # Usa @estante/common-types
│
├── package.json               # Define workspaces
└── node_modules/
    └── @estante/
        └── common-types/      # Symlink → packages/common-types
```

---

## ⚙️ Configuração

### 1. package.json raiz

```json
{
  "workspaces": [
    "packages/*",
    "backend-api",
    "backend-functions"
  ]
}
```

### 2. backend-api/package.json

```json
{
  "dependencies": {
    "@estante/common-types": "*"
  }
}
```

O `"*"` significa: **"use a versão do workspace local"**

### 3. packages/common-types/package.json

```json
{
  "name": "@estante/common-types",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

---

## 🔨 Como Funciona

### Quando você executa `npm install`:

1. NPM detecta os workspaces definidos no package.json raiz
2. Cria um **symlink** em `node_modules/@estante/common-types` → `packages/common-types`
3. Todas as dependências são **hoisted** (movidas) para o `node_modules` raiz
4. Workspaces compartilham as mesmas dependências (economia de espaço)

### Quando você importa no código:

**Frontend:**
```typescript
import { User, Friendship } from '@estante/common-types';
```

**Backend:**
```typescript
import { User, Friendship } from '@estante/common-types';
```

O TypeScript/Node resolve automaticamente através do symlink!

---

## 🚀 Fluxo de Desenvolvimento

### 1. Modificar tipos compartilhados

```bash
# Edite arquivos em packages/common-types/src/
vim packages/common-types/src/user.model.ts

# Compile os tipos
npm run build:common
# ou
npm run build --workspace=@estante/common-types
```

### 2. Mudanças são refletidas automaticamente

Como é um **symlink**, os workspaces veem as mudanças imediatamente após `npm run build:common`!

- ✅ Frontend vê as mudanças
- ✅ Backend-API vê as mudanças
- ❌ **Não precisa** reinstalar dependências
- ❌ **Não precisa** gerar .tgz
- ❌ **Não precisa** fazer npm link

### 3. Testar mudanças

```bash
# Terminal 1: Rebuild common-types em watch mode
cd packages/common-types
npx tsc --watch

# Terminal 2: Backend API
cd backend-api
npm run dev

# Terminal 3: Frontend
npm run dev
```

---

## 📝 Scripts Úteis

### Build apenas common-types
```bash
npm run build:common
```

### Build tudo (common-types + client + server + api)
```bash
npm run build
```

### Listar dependências de um workspace
```bash
npm ls @estante/common-types --workspace=backend-api
```

### Adicionar dependência a um workspace específico
```bash
npm install lodash --workspace=backend-api
```

### Executar script em workspace específico
```bash
npm run test --workspace=backend-api
```

---

## ❌ O que NÃO fazer (Anti-patterns)

### ❌ Gerar tarballs (.tgz)
```bash
# NÃO FAÇA ISSO:
cd packages/common-types
npm pack
cp estante-common-types-1.0.0.tgz ../../backend-api/
```

**Por quê?**
- Cria arquivos desnecessários
- Precisa rebuild e cópia toda vez que muda
- Não é rastreado pelo Git
- Performance pior

### ❌ Usar `file:./path/to/tgz`
```json
{
  "dependencies": {
    "@estante/common-types": "file:./estante-common-types-1.0.0.tgz"
  }
}
```

**Por quê?**
- NPM Workspaces faz isso automaticamente e melhor
- Requer atualização manual do caminho
- Versão pode ficar desatualizada

### ❌ npm link manual
```bash
# NÃO PRECISA:
cd packages/common-types
npm link
cd ../../backend-api
npm link @estante/common-types
```

**Por quê?**
- Workspaces já cria os links automaticamente
- Pode causar conflitos
- Mais complexo de manter

---

## ✅ Boas Práticas (Como grandes projetos fazem)

### ✅ 1. Use `"*"` ou `"workspace:*"` para dependências de workspace
```json
{
  "dependencies": {
    "@estante/common-types": "*"
  }
}
```

### ✅ 2. Build common-types antes de usar
```bash
# Sempre build common-types primeiro
npm run build:common

# Depois use em outros workspaces
npm run dev --workspace=backend-api
```

### ✅ 3. Ignore arquivos gerados no .gitignore
```gitignore
*.tgz
*.tar.gz
dist/
node_modules/
```

### ✅ 4. Use scripts do workspace raiz
```json
{
  "scripts": {
    "build:common": "npm run build --workspace=@estante/common-types",
    "dev:backend": "npm run dev --workspace=backend-api",
    "dev:all": "npm run build:common && npm run dev"
  }
}
```

---

## 🔍 Como Verificar se está funcionando

### 1. Verificar symlink
```bash
ls -la node_modules/@estante/common-types
# Deve mostrar: common-types -> ../../packages/common-types
```

### 2. Verificar resolução no backend
```bash
cd backend-api
node -e "console.log(require.resolve('@estante/common-types'))"
# Deve apontar para: ../packages/common-types/dist/index.js
```

### 3. Verificar TypeScript
```bash
npx tsc --noEmit
# Não deve ter erros de tipo não encontrado
```

---

## 🌟 Exemplos de Grandes Projetos que Usam Workspaces

1. **React** (Meta) - Monorepo com 100+ pacotes
2. **Next.js** (Vercel) - Framework e plugins
3. **Turborepo** (Vercel) - Build system para monorepos
4. **Material-UI** - Componentes e temas
5. **Babel** - Plugins e presets
6. **Jest** - Framework de testes e runners
7. **Prettier** - Formatador e plugins
8. **TypeScript** - Compilador e language server

---

## 📚 Recursos Adicionais

- [NPM Workspaces Docs](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
- [Monorepo Best Practices](https://monorepo.tools/)
- [Turborepo](https://turbo.build/repo)
- [Lerna (alternativa)](https://lerna.js.org/)

---

## 🎉 Resumo

- ✅ **Workspaces configurados** e funcionando
- ✅ **Symlinks automáticos** criados
- ✅ **Sem arquivos .tgz** necessários
- ✅ **Mudanças instantâneas** após build
- ✅ **Mesma abordagem** de grandes empresas

**Esta é a forma CORRETA e MODERNA de gerenciar pacotes compartilhados!** 🚀
