# 🚀 Modos de Desenvolvimento

Este projeto suporta **3 modos diferentes** de desenvolvimento. Escolha o que melhor se adequa à sua necessidade.

---

## 🎯 Modo 1: HÍBRIDO (Recomendado para desenvolvimento)

**Ideal para:** Testar o backend com dados reais de produção sem rodar emuladores.

### Configuração (.env):
```env
VITE_USE_PROD_API=true
VITE_USE_FIREBASE_EMULATORS=false
```

### Como usar:

**Terminal 1 - Backend API (porta 3000):**
```bash
cd backend-api
npm run dev
```

**Terminal 2 - Frontend (porta 5173):**
```bash
npm run dev
```

### O que acontece:
- ✅ **Backend API:** Rodando localmente em `http://localhost:3000`
- ✅ **Firebase (Auth, Firestore, Storage, etc.):** Produção (dados reais)
- ✅ **Frontend:** Acessa API local através de proxy do Vite

### Vantagens:
- Usa dados reais de produção (ex: 300 amigos já cadastrados)
- Debugar e testar o backend-api localmente
- Não precisa popular emuladores com dados de teste
- Mais rápido para iniciar

---

## 🛠️ Modo 2: EMULADORES LOCAIS

**Ideal para:** Desenvolvimento 100% offline ou quando não quer afetar produção.

### Configuração (.env):
```env
VITE_USE_PROD_API=false
VITE_USE_FIREBASE_EMULATORS=true
```

### Como usar:

**Terminal 1 - Firebase Emulators:**
```bash
firebase emulators:start
```

**Terminal 2 - Frontend (porta 5173):**
```bash
npm run dev
```

### O que acontece:
- ✅ **Backend API:** Rodando no emulador Firebase Functions (porta 5001)
- ✅ **Firebase:** Emuladores locais (Auth:9099, Firestore:8080, Storage:9199, etc.)
- ✅ **Frontend:** Acessa tudo localmente

### Vantagens:
- Ambiente 100% isolado
- Não afeta dados de produção
- Simula exatamente o ambiente de produção

### Desvantagens:
- Precisa popular dados de teste nos emuladores
- Dados são perdidos ao reiniciar emuladores
- Mais lento para iniciar

---

## 🌐 Modo 3: PRODUÇÃO COMPLETA

**Ideal para:** Testar contra a API de produção.

### Configuração (.env):
```env
VITE_USE_PROD_API=true
VITE_USE_FIREBASE_EMULATORS=false
```

### Como usar:

**Terminal único - Frontend (porta 5173):**
```bash
npm run dev
```

### O que acontece:
- ✅ **Backend API:** Produção (Cloud Functions)
- ✅ **Firebase:** Produção
- ✅ **Frontend:** Acessa API de produção através de proxy do Vite

### Quando usar:
- Testar integrações com a API em produção
- Validar antes de fazer deploy
- Debugar problemas que só acontecem em produção

---

## 📋 Resumo Rápido

| Configuração           | Backend API         | Firebase    | Dados | Uso Recomendado            |
|------------------------|---------------------|-------------|-------|----------------------------|
| **Modo 1: HÍBRIDO**    | Local (3000)        | Produção    | Reais | ✅ Desenvolvimento diário  |
| **Modo 2: EMULADORES** | Emulador (5001)     | Emuladores  | Teste | Testes isolados            |
| **Modo 3: PRODUÇÃO**   | Produção            | Produção    | Reais | Validação final            |

---

## 🔍 Como saber qual modo está ativo?

Ao iniciar o frontend (`npm run dev`), verifique o console do navegador:

- **Modo 1 (Híbrido):**
  ```
  🔧 Ambiente de DEV: Modo HÍBRIDO (Backend API Local + Firebase Produção)
  🚀 API Proxy Target: http://127.0.0.1:3000
  ```

- **Modo 2 (Emuladores):**
  ```
  🛠️ Ambiente de DEV: Conectando aos emuladores locais do Firebase...
  🚀 API Proxy Target: http://127.0.0.1:5001/...
  ```

- **Modo 3 (Produção):**
  ```
  🚀 Ambiente de DEV: Usando serviços de PRODUÇÃO (Nuvem)
  🚀 API Proxy Target: https://us-central1-estante-75463...
  ```

---

## ⚠️ Notas Importantes

1. **Sempre reinicie o servidor de desenvolvimento** após alterar o arquivo `.env`
2. No **Modo 1 (Híbrido)**, você precisa rodar **2 terminais** (backend + frontend)
3. No **Modo 2 (Emuladores)**, você precisa rodar **2 terminais** (emulators + frontend)
4. No **Modo 3 (Produção)**, você precisa rodar **1 terminal** (apenas frontend)

---

## 🐛 Problemas Comuns

### Erro: `ERR_CONNECTION_REFUSED` na porta 9099
- **Causa:** Frontend configurado para emuladores, mas eles não estão rodando
- **Solução:** Mude para Modo 1 (Híbrido) ou inicie os emuladores

### Erro: `ERR_CONNECTION_REFUSED` na porta 3000
- **Causa:** Frontend configurado para Modo Híbrido, mas backend-api não está rodando
- **Solução:** Execute `cd backend-api && npm run dev`

### Erro: Dados não aparecem
- **Causa:** Modo Emuladores sem dados populados
- **Solução:** Mude para Modo 1 (Híbrido) para usar dados de produção
