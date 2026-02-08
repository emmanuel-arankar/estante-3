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

## 2. Deploy do Backend (Functions)

Para atualizar a lógica do servidor (incluindo correções de erro 500/Batch):

```bash
firebase deploy --only functions
```

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
   - Troque o `target` de `http://127.0.0.1:5001/...` para `https://us-central1-estante-virtual-805ef.cloudfunctions.net/api`
3. Rode `npm run dev`.

Isso fará com que seu `localhost` acesse diretamente os servidores do Google.
