# 📊 Guia de Métricas e Alertas — Google Cloud Console

Guia passo a passo para configurar dashboards e alertas para o projeto **estante-75463**.

> **Pré-requisito**: O structured logging já está implementado no backend (`lib/logger.ts`, `logging.middleware.ts`, `performance.middleware.ts`).

---

## 1. Métricas Disponíveis

O backend emite automaticamente estas métricas via structured logging:

| Métrica | Campo no Log | Fonte |
|---|---|---|
| Latência de API | `metricValue` (em `METRICA: api_latency_ms`) | `logging.middleware.ts` |
| Request lenta (>1s) | `durationMs` (em `Slow Request Detected`) | `performance.middleware.ts` |
| Request timeout (504) | `durationMs` (em `Request Timeout Detected`) | `performance.middleware.ts` |
| Erros HTTP | `statusCode >= 400` (em `API Response`) | `logging.middleware.ts` |

---

## 2. Criar Dashboard no Cloud Console

### Passo 1: Acessar Monitoring
```
https://console.cloud.google.com/monitoring/dashboards?project=estante-75463
```

### Passo 2: Criar Dashboard
1. Clique **"+ Create Dashboard"**
2. Nomeie: **"Estante API Health"**

### Passo 3: Adicionar Widgets

#### Widget 1 — Latência p50/p95/p99
- **Tipo**: Line Chart
- **Resource**: Cloud Run Revision (ou Cloud Functions)
- **Metric**: `request_latencies`
- **Aggregation**: p50, p95, p99

#### Widget 2 — Taxa de Erros (4xx/5xx)
- **Tipo**: Line Chart
- **Metric**: Log-based metric (ver seção 3)
- **Filter**: `severity >= WARNING`

#### Widget 3 — Requests/Segundo
- **Tipo**: Line Chart
- **Resource**: Cloud Run / Cloud Functions
- **Metric**: `request_count`
- **Aggregation**: Rate

#### Widget 4 — Uso de Memória
- **Tipo**: Line Chart
- **Resource**: Cloud Run / Cloud Functions
- **Metric**: `container/memory/utilization`

---

## 3. Criar Log-Based Metrics

Para métricas customizadas baseadas nos logs do backend:

### Métrica: API Error Rate
```bash
gcloud logging metrics create api_error_rate \
  --project=estante-75463 \
  --description="Taxa de erros HTTP 4xx e 5xx" \
  --log-filter='resource.type="cloud_run_revision"
    jsonPayload.message="API Response"
    jsonPayload.statusCode>=400'
```

### Métrica: Slow Requests
```bash
gcloud logging metrics create slow_requests \
  --project=estante-75463 \
  --description="Requisições com latência acima do threshold" \
  --log-filter='resource.type="cloud_run_revision"
    jsonPayload.message=~"Slow Request|Request Timeout"'
```

### Métrica: Latência por Endpoint (Distribution)
```bash
gcloud logging metrics create api_latency_distribution \
  --project=estante-75463 \
  --description="Distribuição de latência por endpoint" \
  --log-filter='resource.type="cloud_run_revision"
    jsonPayload.message="METRICA: api_latency_ms"' \
  --bucket-options=exponential=40,1.4,10 \
  --value-extractor='EXTRACT(jsonPayload.metricValue)'
```

---

## 4. Configurar Alertas

### Alerta 1: Taxa de Erros > 5%

```
Console → Monitoring → Alerting → Create Policy
```
- **Condition**: Log-based metric `api_error_rate`
- **Threshold**: > 5 por 5 minutos (rolling window)
- **Notification**: Email / Slack / PagerDuty

### Alerta 2: Latência p95 > 3s

- **Condition**: Cloud Run `request_latencies` (p95)
- **Threshold**: > 3000ms por 10 minutos
- **Duration**: 10 minutos consecutivos

### Alerta 3: Cloud Function com Erro

- **Resource**: Cloud Functions
- **Metric**: `function/execution_count` com filtro `status != "ok"`
- **Threshold**: > 3 execuções com erro em 5 minutos

### Via gcloud CLI (alternativa):

```bash
# Exemplo: alerta de error rate
gcloud alpha monitoring policies create \
  --display-name="API Error Rate Alta" \
  --condition-display-name="Erros > 5 em 5min" \
  --condition-filter='metric.type="logging.googleapis.com/user/api_error_rate"' \
  --condition-threshold-value=5 \
  --condition-threshold-duration=300s \
  --notification-channels="YOUR_CHANNEL_ID"
```

---

## 5. Filtros Úteis no Cloud Logging

### Ver todos os erros
```
resource.type="cloud_run_revision"
severity>=ERROR
```

### Ver requisições lentas
```
resource.type="cloud_run_revision"
jsonPayload.message=~"Slow Request"
```

### Ver métricas de latência por endpoint
```
resource.type="cloud_run_revision"
jsonPayload.message="METRICA: api_latency_ms"
jsonPayload.endpoint="GET /api/friendships"
```

### Ver erros 500 de um endpoint específico
```
resource.type="cloud_run_revision"
jsonPayload.message="API Response"
jsonPayload.statusCode>=500
jsonPayload.endpoint="POST /api/chat/messages"
```

---

## 6. Checklist Pós-Deploy

- [ ] Verificar que logs aparecem no Cloud Logging
- [ ] Confirmar formato JSON dos logs (structured)
- [ ] Criar log-based metrics (seção 3)
- [ ] Montar dashboard (seção 2)
- [ ] Configurar pelo menos 1 alerta (seção 4)
- [ ] Testar alerta com request intencionalmente lenta
- [ ] Configurar canal de notificação (email ou Slack)
