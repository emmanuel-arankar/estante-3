# 📦 Sistema de CDN - Documentação

## ✅ O que foi implementado

### 1. Helper de CDN (`src/lib/cdn.ts`)

Sistema completo para preparar a aplicação para Cloud CDN:

- **`getCDNUrl(storageUrl)`** - Converte URLs do Firebase Storage para CDN
- **`getOptimizedImageUrl(storageUrl, options)`** - URLs otimizadas com transformações
- **`CACHE_CONFIGS`** - Configurações de cache para diferentes tipos de assets

### 2. Upload com Cache Headers (`src/services/storage.ts`)

Todos os uploads agora incluem cache headers otimizados:

- **Fotos de perfil**: Cache de 1 dia
- **Imagens de posts**: Cache de 1 semana  
- **Assets imutáveis**: Cache de 1 ano

---

## 🚀 Como Usar

### No Frontend - Converter URLs para CDN

```typescript
import { getCDNUrl } from '@/lib/cdn';
import { Avatar, AvatarImage } from '@/components/ui/avatar';

// Em qualquer componente
function UserAvatar({ photoURL }: { photoURL?: string }) {
  // Converte automaticamente para CDN se configurado
  const cdnUrl = getCDNUrl(photoURL);
  
  return (
    <Avatar>
      <AvatarImage src={cdnUrl} alt="Avatar" />
    </Avatar>
  );
}
```

### Com Transformações (futuro)

```typescript
import { getOptimizedImageUrl } from '@/lib/cdn';

// Quando configurar serviço de transformação (Cloudflare Images, imgix, etc)
const thumbnailUrl = getOptimizedImageUrl(profilePhoto, {
  width: 200,
  height: 200,
  format: 'webp',
  quality: 85
});

return <img src={thumbnailUrl} alt="Thumbnail" />;
```

### Configurar Cache Específico no Upload

```typescript
import { uploadImage } from '@/services/storage';
import { CACHE_CONFIGS } from '@/lib/cdn';

// Upload de capa de livro (nunca muda)
await uploadImage(file, `book_covers/${bookId}.jpg`, CACHE_CONFIGS.BOOK_COVER);

// Upload de foto temporária (expira em 1 hora)
await uploadImage(file, `temp/${tempId}.jpg`, CACHE_CONFIGS.TEMPORARY);
```

---

## ⚙️ Configuração do CDN

### Passo 1: Deixar vazio por enquanto

O sistema já está preparado. Por padrão, `VITE_CDN_DOMAIN` está vazio, então usa URLs normais do Firebase Storage.

### Passo 2: Quando tiver tráfego, configurar Load Balancer

1. **Criar Load Balancer no Google Cloud Console:**
   - Console → Network Services → Load Balancing
   - Create → Application Load Balancer (HTTP/HTTPS)
   - Backend: Bucket `estante-75463.appspot.com`
   - ✅ **Enable Cloud CDN**

2. **Configurar domínio customizado:**
   - Criar registro DNS: `cdn.estantebolso.com` → IP do Load Balancer
   - Configurar SSL certificate (managed)

3. **Atualizar `.env`:**
   ```env
   VITE_CDN_DOMAIN=https://cdn.estantebolso.com
   ```

4. **Rebuild e deploy:**
   ```bash
   npm run build
   firebase deploy
   ```

**Pronto!** Todas as URLs serão automaticamente convertidas para CDN.

---

## 📊 Configurações de Cache por Tipo

| Tipo de Asset | Cache Duration | Uso |
|--------------|----------------|-----|
| **IMMUTABLE** | 1 ano | Assets com hash no nome (nunca mudam) |
| **PROFILE_PHOTO** | 1 dia | Fotos de perfil (podem mudar) |
| **POST_IMAGE** | 1 semana | Imagens de posts (raramente mudam) |
| **BOOK_COVER** | 1 ano | Capas de livros (nunca mudam) |
| **TEMPORARY** | 1 hora | Arquivos temporários |

### Como escolher?

```typescript
// ✅ Asset nunca muda (tem hash/timestamp no nome)
CACHE_CONFIGS.IMMUTABLE

// ✅ Asset pode mudar ocasionalmente
CACHE_CONFIGS.PROFILE_PHOTO

// ✅ Asset raramente muda
CACHE_CONFIGS.POST_IMAGE

// ✅ Asset nunca muda (identificado por ID fixo)
CACHE_CONFIGS.BOOK_COVER

// ✅ Asset é temporário
CACHE_CONFIGS.TEMPORARY
```

---

## 🧪 Testes

### Verificar Cache Headers

Após upload, verificar se os headers estão corretos:

```bash
# Windows PowerShell
curl -I "https://firebasestorage.googleapis.com/v0/b/.../o/avatars%2F...?alt=media"

# Deve retornar:
# Cache-Control: public, max-age=86400
# Content-Type: image/jpeg
```

### Verificar Conversão CDN

```typescript
import { getCDNUrl } from '@/lib/cdn';

const original = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Ffile.jpg?alt=media';
const cdn = getCDNUrl(original);

console.log('Original:', original);
console.log('CDN:', cdn);

// Com VITE_CDN_DOMAIN vazio:
// CDN: https://firebasestorage.googleapis.com/... (mesmo)

// Com VITE_CDN_DOMAIN configurado:
// CDN: https://cdn.estantebolso.com/path/file.jpg
```

---

## 💰 Economia Esperada (com CDN ativo)

### Sem CDN
- 800k usuários × 2MB imagens/dia = 1.6TB/mês
- Custo egress: $0.12/GB = **$192/mês**

### Com CDN
- Cache hit rate: ~85%
- Egress: 1.6TB × 15% = 240GB/mês
- Custo CDN: $0.08/GB × 240GB = $19/mês
- Load Balancer: $29/mês
- **Total: $48/mês (economia de 75%)**

---

## 🔧 Troubleshooting

### URLs não mudam (ainda sem CDN)

✅ **Esperado!** Enquanto `VITE_CDN_DOMAIN` estiver vazio, `getCDNUrl()` retorna a URL original.

O código está preparado, mas CDN só será ativado quando você configurar.

### Cache headers não aparecem

Verifique se o upload está usando o helper atualizado:

```typescript
// ❌ ERRADO (código antigo)
const url = await uploadImage(file, path); // sem cache header

// ✅ CERTO (código novo)
const url = await uploadImage(file, path, CACHE_CONFIGS.PROFILE_PHOTO);
```

### Como atualizar assets antigos?

Assets antigos no Storage não têm cache headers. Opções:

1. **Esperar até serem trocados** (próxima foto de perfil, etc)
2. **Script de migração** (batch update de metadata)

---

## ✅ Status Atual

- [x] Helper CDN criado
- [x] Cache headers configurados nos uploads
- [x] Código preparado para CDN futuro
- [ ] Load Balancer + CDN (quando tiver tráfego)
- [ ] Domínio customizado
- [ ] Compressão automática de imagens

---

## ➡️ Próximos Passos

1. **Agora (sem custo)**: Código já está preparado ✅
2. **Quando lançar em produção**: Configurar Load Balancer + CDN
3. **Opcional**: Serviço de transformação de imagens (Cloudflare Images, imgix)

---

## 📚 Referências

- [Google Cloud CDN](https://cloud.google.com/cdn)
- [Firebase Storage Cache Control](https://firebase.google.com/docs/storage/web/file-metadata)
- [HTTP Caching Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
