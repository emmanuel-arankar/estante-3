---
description: Como fazer deploy da aplicação para produção (Firebase)
---
# Deploy para Produção

Este workflow descreve como publicar sua aplicação (Backend e Frontend) para o ambiente de produção no Firebase.

> [!WARNING]
> Certifique-se de que você testou suas alterações localmente. Fazer deploy sobrescreverá a versão online do seu site.

## 1. Build da Aplicação

Antes de tudo, é necessário compilar o código.

```bash
npm run build
```

## 2. Deploy do Backend (API)

Para atualizar a API (funções v2/gen2):

1. **Build Obrigatório** (pois removemos o predeploy automático devido a erros):
   ```bash
   cd backend-api
   npm run build
   cd ..
   ```

2. **Deploy Específico da API**:
   ```bash
   firebase deploy --only functions:api
   ```

> [!NOTE]
> Se usar apenas `firebase deploy --only functions`, ele tentará deployar também as funções antigas (v1) que podem estar com erros. Use `functions:api` para focar na nova API.

## 3. Deploy do Frontend (Hosting)

Para atualizar a interface do site (incluindo correções de erro 401/Auth):

```bash
firebase deploy --only hosting
```

## 4. Deploy Completo (Tudo)

Se quiser atualizar tudo de uma vez (incluindo Firestore Rules, Storage Rules, etc):

```bash
firebase deploy
```

---

## Como rodar localmente conectado à Produção?

Se você quer desenvolver localmente (`localhost`) mas usando o Backend e Banco da NUVEM (sem emuladores):

1. **Pare** o `npm run serve` (se estiver rodando).
2. **Edite** o arquivo `vite.config.ts` para apontar o proxy para a nuvem:
   - Troque o `target` de `http://127.0.0.1:5001/...` para `https://us-central1-estante-75463.cloudfunctions.net/api`
3. Rode `npm run dev`.

Isso fará com que seu `localhost` acesse diretamente os servidores do Google.
