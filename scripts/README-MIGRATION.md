# Migração de Friendships para IDs Compostos

Este documento explica como migrar os documentos de friendships de IDs aleatórios para IDs compostos (formato usado por grandes redes sociais).

## 📋 O que esta migração faz?

**Antes:**
```
Documento ID: i4WK6i0Lj2EYviqv0Sgn (ID aleatório)
userId: 2ts3RVN0aOSTqXrq9x3rFFrUdOz1
friendId: DEtIdyHeYnb4QHsE5wTylkvNBIL2
```

**Depois:**
```
Documento ID: 2ts3RVN0aOSTqXrq9x3rFFrUdOz1_DEtIdyHeYnb4QHsE5wTylkvNBIL2
userId: 2ts3RVN0aOSTqXrq9x3rFFrUdOz1
friendId: DEtIdyHeYnb4QHsE5wTylkvNBIL2
```

## ✅ Benefícios

- 🚀 **Performance O(1)**: Busca direta sem queries
- 💰 **Menor custo**: Menos operações de leitura no Firestore
- 🔒 **Previne duplicatas**: ID composto garante unicidade
- 🏢 **Padrão da indústria**: Usado por Facebook, Instagram, Twitter

## 🔧 Pré-requisitos

1. **Backup do Firestore**
   - Vá para Firebase Console → Firestore Database → Backup
   - Ou use o comando: `gcloud firestore export gs://[BUCKET_NAME]`

2. **Dependências instaladas**
   ```bash
   npm install dotenv
   # ou
   yarn add dotenv
   ```

3. **Arquivo .env configurado**
   - Certifique-se de que seu `.env` contém as credenciais do Firebase

## 🚀 Como Executar

### Passo 1: Teste em DRY RUN (Simulação)

Primeiro, execute em modo de simulação para ver o que será feito:

```bash
npx tsx scripts/migrate-friendships-to-composite-ids.ts
```

O script mostrará:
- Quantos documentos precisam ser migrados
- Quantos pares foram encontrados
- Quais operações serão executadas
- **NÃO ALTERARÁ DADOS** (apenas mostra o que seria feito)

### Passo 2: Revisar os Logs

Revise cuidadosamente a saída:

```
✅ Pares válidos: 10
❌ Pares inválidos: 0
📊 Operações totais: 40
```

Se houver **pares inválidos**, investigue antes de prosseguir.

### Passo 3: Executar Migração Real

**⚠️ ATENÇÃO: Esta operação altera dados no Firestore!**

1. Abra o arquivo: `scripts/migrate-friendships-to-composite-ids.ts`
2. Encontre a linha: `const DRY_RUN = true;`
3. Mude para: `const DRY_RUN = false;`
4. Salve o arquivo
5. Execute novamente:

```bash
npx tsx scripts/migrate-friendships-to-composite-ids.ts
```

### Passo 4: Verificar Resultados

1. Acesse o Firebase Console → Firestore Database
2. Navegue para a coleção `friendships`
3. Verifique se os documentos agora têm IDs no formato `userId_friendId`
4. Teste as funcionalidades de amizade no app:
   - ✅ Aceitar solicitação
   - ✅ Recusar solicitação
   - ✅ Remover amigo
   - ✅ Cancelar solicitação enviada

## 📊 O que o Script Faz Internamente

1. **Busca** todos os documentos de `friendships`
2. **Filtra** apenas os que têm IDs aleatórios (sem `_`)
3. **Agrupa** em pares (cada friendship tem 2 documentos espelhados)
4. **Valida** se os pares estão consistentes
5. **Cria** novos documentos com IDs compostos
6. **Deleta** documentos antigos
7. **Processa em batches** (500 operações por vez)

## 🛡️ Segurança

- ✅ Verifica se documentos já existem antes de criar
- ✅ Valida pares antes de migrar
- ✅ Processa em batches para não sobrecarregar
- ✅ Modo DRY RUN para testar sem alterar dados
- ✅ Logs detalhados de cada operação

## 🐛 Troubleshooting

### Erro: "Variáveis de ambiente não encontradas"

**Solução:** Verifique se o arquivo `.env` existe na raiz do projeto e contém:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
# etc
```

### Erro: "Permission denied"

**Solução:** Verifique as regras de segurança do Firestore. Durante a migração, você pode precisar de permissões de admin.

### Pares Inválidos Detectados

**Solução:** Investigue os documentos listados. Possíveis causas:
- Documentos órfãos (sem par)
- Dados inconsistentes entre os pares
- Status diferentes entre os documentos do par

### Script demora muito

**Solução:** Isso é normal se você tem muitos documentos. O script processa em batches de 125 pares por vez com delay de 1 segundo entre batches.

## 📝 Notas Importantes

1. **Documentos já com IDs compostos** são automaticamente ignorados
2. **Dados denormalizados** (campo `friend`) são preservados
3. **Timestamps** (createdAt, updatedAt, friendshipDate) são mantidos
4. **Contadores** nos documentos de usuários NÃO são afetados

## 🔄 Reverter Migração

Se precisar reverter, você terá que:

1. Restaurar do backup do Firestore
2. Ou criar um script reverso (não recomendado)

**Recomendação:** Sempre teste primeiro em ambiente de desenvolvimento!

## 📞 Suporte

Se encontrar problemas:
1. Revise os logs do script
2. Verifique o Firebase Console
3. Teste em ambiente de desenvolvimento primeiro
4. Faça backup antes de executar em produção
