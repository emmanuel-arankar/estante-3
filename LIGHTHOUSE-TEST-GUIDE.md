# 🚀 Teste de Performance - Lighthouse

## 📊 Como Testar

### Opção 1: Chrome DevTools (Recomendado)

1. **Build de produção**
```bash
npm run build
npm run preview
```

2. **Abrir no Chrome**
   - Navegue para `http://localhost:4173`
   - Faça login (para testar páginas autenticadas)

3. **Lighthouse**
   - F12 → Aba **Lighthouse**
   - Configuração:
     - ✅ Performance
     - ✅ Best Practices
     - ✅ SEO
     - ✅ PWA
     - Device: **Mobile** (mais rigoroso)
     - Categories: **Todas**
   
4. **Analyze page load**

---

### Opção 2: CLI (Mais preciso)

```bash
# Instalar lighthouse globalmente
npm install -g lighthouse

# Rodar teste (com servidor rodando)
lighthouse http://localhost:4173 --view

# Ou salvar report
lighthouse http://localhost:4173 --output html --output-path ./lighthouse-report.html
```

---

## 📈 Métricas Importantes

### Performance (Esperado: 85-95+)

**Core Web Vitals:**
- **LCP** (Largest Contentful Paint): < 2.5s ✅
- **TBT** (Total Blocking Time): < 200ms ✅
- **CLS** (Cumulative Layout Shift): < 0.1 ✅

**Outras:**
- **FCP** (First Contentful Paint): < 1.8s
- **Speed Index**: < 3.4s
- **TTI** (Time to Interactive): < 3.8s

### PWA (Esperado: 90+)

- ✅ Installable
- ✅ Service Worker
- ✅ Manifest válido
- ✅ Ícones corretos
- ✅ Offline ready

### Best Practices (Esperado: 90+)

- ✅ HTTPS (em produção)
- ✅ Imagens com lazy loading
- ✅ Sem erros de console

---

## 🎯 Impacto Esperado do Lazy Loading

### Antes (sem lazy loading):
```
Performance: ~70-80
- LCP: ~3.5s
- Total Blocking Time: ~400ms
- Images: 100+ requests simultâneos
```

### Depois (com lazy loading):
```
Performance: 85-95+ ⬆️
- LCP: ~2.0s ⬇️ (-40%)
- Total Blocking Time: ~200ms ⬇️ (-50%)
- Images: ~10-20 requests iniciais ⬇️ (-80%)
```

---

## 📸 Páginas para Testar

### 1. **Home (Feed)**
   - Muitos avatares
   - Imagens de posts
   - **Maior impacto esperado**

### 2. **Lista de Amigos**
   - Muitos avatares em lista
   - Esperado: Carrega rápido mesmo com 100+ amigos

### 3. **Chat**
   - Mensagens com imagens
   - Avatares de contatos

### 4. **Perfil**
   - Avatar, cover photo
   - Galeria de fotos

---

## 🔍 Como Analisar Resultados

### Network Tab (F12 → Network)

**Antes de scrollar:**
- Ver quantas imagens carregaram
- Esperado: Apenas ~10-20 imagens visíveis

**Ao scrollar:**
- Imagens carregam **sob demanda**
- No console: `GET https://firebasestorage...` conforme scrolla

### Performance Tab

1. F12 → **Performance**
2. Clique em **Record** (●)
3. Recarregue a página
4. Aguarde carregamento completo
5. **Stop**

**Analisar:**
- Timeline: Imagens carregam em "batches"
- Não bloqueia o main thread
- FCP muito mais rápido

---

## ✅ Checklist de Verificação

### Performance
- [ ] Lighthouse Performance > 85
- [ ] LCP < 2.5s
- [ ] Imagens carregam lazy (Network tab)
- [ ] Scroll suave sem travamentos

### PWA
- [ ] Lighthouse PWA > 90
- [ ] Installable
- [ ] Service Worker ativo
- [ ] Offline funciona

### Lazy Loading
- [ ] Somente imagens visíveis carregam inicialmente
- [ ] Ao scrollar, novas imagens aparecem
- [ ] Console workbox mostra cache funcionando

---

## 🎬 Teste Prático Agora

```bash
# Terminal 1: Build e preview
npm run build
npm run preview

# Abrir Chrome
# http://localhost:4173

# Fazer login
# Ir para Home (feed)

# F12 → Network → Filtrar: Img
# Recarregar página
# Contar quantas imagens carregaram

# Scrollar devagar
# Ver novas imagens carregando sob demanda

# F12 → Lighthouse
# Run analysis
```

---

## 📊 Onde Ver Lazy Loading Funcionando

### Console do Browser

```
workbox Using CacheFirst to respond to 'https://firebasestorage...'
workbox Router is responding to: https://firebasestorage...
```

### Network Tab

- **Antes de scrollar**: ~10-20 requests
- **Ao scrollar**: +5-10 requests por scroll
- **Total economizado**: ~80% menos requests iniciais

---

## 🚨 Troubleshoot

### Performance ainda baixa?

1. **Limpar cache**
   - F12 → Application → Clear site data
   - Hard refresh (Ctrl+Shift+R)

2. **Testar em aba anônima**
   - Sem extensões interferindo

3. **Verificar Lighthouse warnings**
   - Seguir sugestões específicas

### Lazy loading não funciona?

1. **Verificar console**
   - Erros de carregamento?
   - Workbox funcionando?

2. **Network tab**
   - Filtrar: Img
   - Ver se imagens têm `loading: lazy` no header

---

## 🎉 Resultado Esperado

Após implementar lazy loading:

```
✅ Performance: 85-95 (+15 pontos)
✅ PWA: 90+ (completo)
✅ Best Practices: 90+
✅ SEO: 90+

💾 Dados salvos: ~2-3 MB em carregamento inicial
⚡ LCP: ~2.0s (antes: ~3.5s)
🖼️ Imagens: 10-20 iniciais (antes: 100+)
```

**Pronto para melhorias de produção!** 🚀
