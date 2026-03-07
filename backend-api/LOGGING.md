# 📊 Sistema de Logging - Guia de Uso

Este documento explica como usar o novo sistema de **structured logging** implementado no backend-api.

---

## ✅ O que foi implementado

### 1. **Helper de Logging Centralizado** (`lib/logger.ts`)

Todos os logs agora seguem um formato JSON padronizado:

```typescript
import { log } from '../lib/logger';

// Log de informação
log.info('Usuário criado com sucesso', { 
  userId: 'abc123',
  email: 'user@example.com' 
});

// Log de aviso
log.warn('Cache miss', { 
  key: 'user:abc123',
  endpoint: '/api/users' 
});

// Log de erro
log.error('Falha ao salvar no Firestore', error, {
  userId: 'abc123',
  collection: 'users'
});

// Métrica customizada
log.metric('friend_request_sent', 1, {
  userId: 'abc123',
  targetUserId: 'xyz789'
});
```

### 2. **Middleware Automático de Logging**

Todas as requests/responses são automaticamente logadas:

```
INFO: API Request
{
  "method": "GET",
  "path": "/api/friendships",
  "userId": "abc123",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}

INFO: API Response
{
  "method": "GET",
  "path": "/api/friendships",
  "userId": "abc123",
  "statusCode": 200,
  "duration": 145,
  "endpoint": "GET /api/friendships"
}

INFO: METRIC: api_latency_ms
{
  "metricName": "api_latency_ms",
  "metricValue": 145,
  "endpoint": "GET /api/friendships",
  "statusCode": 200
}
```

### 3. **Error Handling Melhorado**

Erros agora têm contexto completo:

```
ERROR: API Error
{
  "endpoint": "POST /api/friendships/request",
  "statusCode": 500,
  "errorCode": "FIRESTORE_ERROR",
  "userId": "abc123",
  "ip": "192.168.1.1",
  "error": {
    "message": "Document not found",
    "stack": "Error: Document not found\n  at ...",
    "name": "FirestoreError"
  }
}
```

---

## 🧪 Como Testar Localmente

### 1. Verificar que o servidor reiniciou

O TypeScript já deve ter recompilado automaticamente. Verifique o terminal:

```bash
# Deve aparecer:
# [backend-api] Compilation complete
```

### 2. Fazer uma requisição de teste

```bash
# No navegador ou Postman:
GET http://localhost:5001/estante-75463/us-central1/api/api/health

# Ou via curl:
curl http://localhost:5001/estante-75463/us-central1/api/api/health
```

### 3. Verificar logs no terminal

Você deve ver logs estruturados como:

```
INFO: API Request { method: 'GET', path: '/api/health', ... }
INFO: API Response { statusCode: 200, duration: 12, ... }
INFO: METRIC: api_latency_ms { metricValue: 12, ... }
```

---

## 📊 Como Ver os Logs no Google Cloud Console

### Passo 1: Acessar Logs Explorer

1. Vá para [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione seu projeto Firebase
3. Menu lateral → **Logging** → **Logs Explorer**

### Passo 2: Queries Úteis

#### Ver todos os erros nas últimas 24h

```
severity="ERROR"
resource.type="cloud_function"
timestamp>="2026-02-15T00:00:00Z"
```

#### Ver requests lentos (> 1s)

```
jsonPayload.metricName="api_latency_ms"
jsonPayload.metricValue>1000
```

#### Ver erros de um usuário específico

```
severity="ERROR"
jsonPayload.userId="USER_ID_AQUI"
```

#### Ver latência média por endpoint

```
jsonPayload.metricName="api_latency_ms"
| stats avg(jsonPayload.metricValue) by jsonPayload.endpoint
```

### Passo 3: Criar Dashboard

1. **Monitoring** → **Dashboards** → **Create Dashboard**
2. Nome: "Estante - API Overview"
3. Adicionar widgets:

#### Widget: Latência P95
- Resource: Cloud Function
- Metric: Function Execution Time
- Aggregation: 95th percentile

#### Widget: Taxa de Erros
- Resource: Cloud Function  
- Metric: Function Error Count
- Filter: severity="ERROR"

#### Widget: Requests por Minuto
- Query: `jsonPayload.metricName="api_latency_ms"`
- Aggregation: count per minute

---

## 🚨 Configurar Alertas

### Alerta 1: Alta Taxa de Erros

1. **Monitoring** → **Alerting** → **Create Policy**
2. Configuração:
   - Nome: "High Error Rate"
   - Condition: `Function Error Count > 10 in 5 minutes`
   - Notification: Seu email

### Alerta 2: Latência Elevada

1. **Create Policy**
2. Configuração:
   - Nome: "High API Latency"
   - Condition: `Average latency > 2000ms for 10 minutes`
   - Notification: Seu email

### Alerta 3: Requests Lentos

1. **Create Policy** (baseado em logs)
2. Condição:
   ```
   jsonPayload.duration>2000
   ```
   - Trigger: `> 5 occurrences in 5 minutes`

---

## 💡 Exemplos de Uso no Código

### Em um endpoint existente

```typescript
// backend-api/src/friends.ts
import { log } from './lib/logger';

router.post('/friendships/request', async (req, res) => {
  const { targetUserId } = req.body;
  const userId = req.user.uid;

  try {
    // Log de início da operação
    log.info('Enviando solicitação de amizade', {
      userId,
      targetUserId,
      endpoint: 'POST /friendships/request'
    });

    // ... lógica do código ...

    // Log de métrica customizada
    log.metric('friend_request_sent', 1, {
      userId,
      targetUserId
    });

    res.status(200).json({ success: true });
  } catch (error) {
    // O error handler já vai logar, mas você pode adicionar contexto
    log.error('Erro ao enviar solicitação', error, {
      userId,
      targetUserId
    });
    throw error;
  }
});
```

### Logar eventos importantes

```typescript
// Quando um usuário faz login pela primeira vez
log.info('First login', {
  userId: newUser.uid,
  provider: 'google',
  timestamp: new Date().toISOString()
});

// Quando atinge um threshold
if (friendCount > 100) {
  log.metric('power_user', 1, {
    userId,
    friendCount
  });
}
```

---

## 📈 Métricas que Agora São Rastreadas

### Automáticas (via middleware)
- ✅ `api_latency_ms` - Latência de cada endpoint
- ✅ Request count por endpoint
- ✅ Status codes (200, 400, 500, etc)
- ✅ Requests lentos (> 2s)

### Customizadas (você pode adicionar)
- `friend_request_sent`
- `friend_request_accepted`
- `post_created`
- `comment_added`
- `user_blocked`
- etc.

---

## 🔧 Próximos Passos

Após testar o sistema de logging:

1. ✅ **Monitorar por 1-2 dias** para coletar dados baseline
2. ➡️ **Identificar endpoints lentos** (> 500ms)
3. ➡️ **Configurar alertas** para erros críticos
4. ➡️ **Próxima tarefa**: Habilitar Cloud CDN

---

## 🐛 Troubleshooting

### Logs não aparecem no Cloud Logging

- Certifique-se de fazer deploy: `firebase deploy --only functions:api`
- Verifique filtros no Logs Explorer (remova todos os filtros)
- Confirme que está olhando o projeto correto

### Muitos logs (muito verboso)

Você pode desabilitar logs de info em produção:

```typescript
// lib/logger.ts
export const log = {
  info: (message: string, context?: LogContext) => {
    // Só loga INFO em desenvolvimento
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      logger.info(message, { ...context });
    }
  },
  // error e warn sempre logam
};
```

### Performance impacto

O overhead de logging é **mínimo** (<5ms por request). Se precisar reduzir:
- Não logue payloads grandes (bodies, respostas completas)
- Use sampling (logar 1 a cada 10 requests de sucesso)

---

## 🚀 Validação em Produção

### Passo 1: Verificar formato dos logs

Após deploy, confirme que os logs aparecem com formato JSON no Cloud Logging:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" jsonPayload.message="API Response"' \
  --project=estante-75463 \
  --limit=5 \
  --format=json
```

### Passo 2: Verificar métricas de latência

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" jsonPayload.message=~"METRICA"' \
  --project=estante-75463 \
  --limit=10 \
  --format=json
```

### Passo 3: Verificar alertas de slow requests

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" jsonPayload.message=~"Slow Request"' \
  --project=estante-75463 \
  --limit=5 \
  --format=json
```

### Passo 4: Configurar Log Sink (opcional)

Para exportar logs para BigQuery ou Cloud Storage:

```bash
gcloud logging sinks create estante-errors-sink \
  bigquery.googleapis.com/projects/estante-75463/datasets/error_logs \
  --log-filter='resource.type="cloud_run_revision" severity>=ERROR' \
  --project=estante-75463
```

> 📖 **Guia completo de métricas e alertas**: Veja [METRICS_SETUP.md](./METRICS_SETUP.md)

---

## ✅ Checklist de Verificação

- [ ] Servidor reiniciou sem erros
- [ ] Logs aparecem no terminal local
- [ ] Request + Response são logados
- [ ] Métricas de latência aparecem
- [ ] Erros têm stack trace completo
- [ ] Dashboard criado no Cloud Monitoring
- [ ] Alertas configurados
- [ ] Log-based metrics criadas (ver METRICS_SETUP.md)
- [ ] Logs validados em produção (comandos acima)
- [ ] Docs lidas e entendidas

🎉 **Parabéns!** Você agora tem observabilidade completa do backend!
