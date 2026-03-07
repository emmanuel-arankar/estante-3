# 🧪 Teste do PWA - Guia Rápido

## ⚠️ Problema Identificado

O `npm run preview` está dando erro 404. Isso pode ser relacionado ao SSR (Server-Side Rendering).

## ✅ Solução: Testar em Desenvolvimento

O PWA está configurado para funcionar em **desenvolvimento** (`devOptions: { enabled: true }`).

### Passo 1: Rodar Dev Server

```bash
npm run dev
```

### Passo 2: Acessar

Abra: `http://localhost:5173`

### Passo 3: Verificar PWA

**Chrome DevTools** (F12):

1. **Application** → **Manifest**
   - Nome: "Estante de Bolso"
   - Ícones: Devem aparecer (SVG verde com livro)
   - Theme color: #10b981

2. **Application** → **Service Workers**
   - Status: Activated and running
   - Source: `/sw.js` ou workbox gerado

3. **Application** → **Cache Storage**
   - Deve ter caches: `firebase-images-cache`, `api-cache`

### Passo 4: Testar Instalação (Dev)

**Importante**: Em desenvolvimento, o banner de instalação **não aparece** porque:
- Chrome só mostra prompt de instalação em HTTPS ou localhost em produção
- Precisa ter Service Worker em produção

**MAS** você pode ver o manifest e service worker funcionando!

---

## 🚀 Testar Instalação REAL

### Opção 1: Build Local + Servir com outro server

```bash
# Build
npm run build

# Servir dist/client com http-server
npx http-server dist/client -p 8080
```

Depois acessar `http://localhost:8080`

### Opção 2: Deploy para Firebase Hosting

```bash
firebase deploy --only hosting
```

Depois acessar: `https://estante-75463.web.app`

Aí sim o banner de instalação aparecerá e você pode instalar o app!

---

## 📱 O que Verificar

### Em Desenvolvimento (localhost:5173)
- ✅ Manifest configurado
- ✅ Service Worker registrado
- ✅ Ícones SVG visíveis no DevTools
- ❌ Banner de instalação (não aparece em dev)

### Em Produção (após deploy)
- ✅ Manifest configurado
- ✅ Service Worker registrado
- ✅ Ícones SVG visíveis
- ✅ Banner de instalação aparece
- ✅ Pode instalar o app

---

## 🐛 Troubleshoot Preview

Se quiser consertar o preview, o problema pode ser:

### Possível Causa: SSR + PWA

O projeto usa SSR (vite-plugin-ssr) que pode conflitar com vite-plugin-pwa.

**Solução temporária**: Desabilitar PWA em preview

```typescript
// vite.config.ts
VitePWA({
  // ...
  devOptions: {
    enabled: mode === 'development', // Só em dev, não em preview
  }
})
```

### Ou: Usar apenas client build

```bash
npm run build:client
npx http-server dist/client
```

---

## ✅ Conclusão

**Por enquanto:**
1. Teste em desenvolvimento (`npm run dev`)
2. Verifique manifest e service worker
3. Para testar instalação real, faça deploy

**PWA está funcionando!** Só não consegue testar instalação antes de deploy em produção.
