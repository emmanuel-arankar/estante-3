# ⚠️ Dashboards: Pré-requisito Importante

## 🚨 Problema Identificado

Atualmente, **dashboards do Cloud Monitoring não vão funcionar** porque:

- ❌ Sua API Express está rodando **apenas localmente** (`npm run dev`)
- ❌ Não está deployed como Cloud Function em produção
- ✅ Apenas os **triggers** (onBlockCreated, etc) estão deployed

**Métricas do Cloud Monitoring só funcionam para recursos em produção (Cloud Functions deployed).**

---

## 🔧 Solução: Deploy da API

### Opção 1: Deploy para produção (Recomendado para dashboards)

```bash
# Deploy de todas as functions (incluindo API)
firebase deploy --only functions
```

Depois do deploy, a função aparecerá como `api` no Cloud Monitoring.

### Opção 2: Aguardar lançamento em produção

Se ainda está em desenvolvimento, faz mais sentido:
1. ✅ **Continuar usando Cloud Logging** (já funciona localmente)
2. ⏸️ **Adiar dashboards** para quando fizer deploy em produção
3. 🎯 **Focar em features** do produto

---

## 📊 Alternativa: Logs Explorer (Funciona agora)

Você pode usar **Logs Explorer** para ver métricas mesmo sem deploy:

### Acessar Logs

1. Google Cloud Console → **Logging** → **Logs Explorer**
2. Query:
   ```
   resource.type="cloud_function"
   jsonPayload.severity="INFO"
   jsonPayload.message="API Response"
   ```

### Ver Latência

```
resource.type="cloud_function"
jsonPayload.metricName="api_latency_ms"
```

### Criar gráfico baseado em logs

1. Executar query acima
2. Clicar em **Create metric** (canto superior direito)
3. Nome: `api_latency_custom`
4. Metric type: Distribution
5. Field: `jsonPayload.metricValue`
6. **Create Metric**

Agora pode criar dashboard com essa métrica customizada!

---

## 💡 Recomendação

Como você ainda está em desenvolvimento:

**Opção A: Fazer deploy agora**
- Deploy da API para produção
- Criar dashboards completos
- Monitorar em produção

**Opção B: Adiar dashboards** ⭐ (Recomendado)
- Continuar desenvolvendo localmente
- Usar Logs Explorer quando precisar
- Criar dashboards quando lançar em produção

---

## ✅ O que funciona AGORA (sem deploy)

- ✅ Logs estruturados no terminal local
- ✅ Logs Explorer no Cloud Console
- ✅ Métricas customizadas baseadas em logs
- ❌ Dashboards pré-configurados (requer Cloud Functions deployed)

---

Qual opção você prefere?
1. Fazer deploy para produção agora
2. Adiar dashboards para quando lançar
3. Usar Logs Explorer por enquanto
