# 📱 PWA - Criação de Ícones

## 🎯 Precisamos criar 3 ícones

Para o PWA funcionar completamente, precisamos destes ícones no diretório `public/`:

1. **pwa-192x192.png** (192x192 pixels)
2. **pwa-512x512.png** (512x512 pixels)  
3. **apple-touch-icon.png** (180x180 pixels)

---

## 🔧 Opção 1: Ferramenta Online (Recomendado)

### PWA Asset Generator

1. Acesse: [https://www.pwabuilder.com/imageGenerator](https://www.pwabuilder.com/imageGenerator)
2. Upload do **logo da Estante** (PNG ou SVG)
3. Escolha "Generate"
4. Download dos ícones gerados
5. Renomeie conforme necessário:
   - `icon-192x192.png` → `pwa-192x192.png`
   - `icon-512x512.png` → `pwa-512x512.png`
   - `apple-icon-180x180.png` → `apple-touch-icon.png`
6. Copie para `estante-3/public/`

---

## 🎨 Opção 2: Criar Manualmente

### Com Figma/Photoshop/GIMP

1. Abra o logo atual da Estante
2. Redimensione para cada tamanho:
   - 192x192px (para Android/PWA)
   - 512x512px (para splash screen)
   - 180x180px (para iOS)
3. Exporte como PNG
4. Salve no diretório `public/` com os nomes corretos

### Dicas de Design

- **Fundo**: Use cor sólida ou transparente
- **Padding**: Deixe ~10% de margem ao redor do logo
- **Maskable**: Se possível, coloque elementos importantes no centro (safe zone)

---

## 🖼️ Ícone Atual

Se você já tem um logo/ícone da Estante de Bolso:
- Onde está localizado?
- Qual o tamanho atual?
- Me passe o caminho que posso gerar os outros tamanhos

---

## ✅ Após criar os ícones

Coloque os 3 arquivos em:
```
estante-3/
└── public/
    ├── pwa-192x192.png
    ├── pwa-512x512.png
    └── apple-touch-icon.png
```

Então rode:
```bash
npm run dev
```

O PWA estará pronto para testar!

---

## 💡 Placeholder Temporário

Se quiser testar AGORA sem ícones:

1. Copie qualquer imagem quadrada que tenha
2. Redimensione online (use [squoosh.app](https://squoosh.app))
3. Renomeie para os nomes necessários
4. O PWA vai funcionar (só não vai ficar bonito no ícone)

Depois substitua pelos ícones definitivos.
