# Migração de Contadores de Usuário

## Problema

Os documentos de usuário existentes não possuem os campos de contadores (`friendsCount`, `pendingRequestsCount`, `sentRequestsCount`). Quando operações usam `increment()` nesses campos, eles são criados com valores incorretos.

## Solução

Este script inicializa os contadores corretos para todos os usuários baseado nas amizades reais no Firestore.

## Como Executar

### 1. Dry Run (Simulação)

Primeiro, execute em modo simulação para ver o que será alterado:

```bash
npm run migrate:counters
```

O script está configurado com `DRY_RUN = false` por padrão, então execute diretamente.

### 2. Análise dos Resultados

O script mostrará:
- Quantos usuários precisam ser atualizados
- Os valores atuais vs. valores corretos para cada contador
- Total de usuários processados

### 3. Executar para Valer

Se os resultados parecerem corretos, o script já terá executado a atualização (porque `DRY_RUN = false`).

Se quiser testar primeiro, edite o arquivo `scripts/initialize-user-counters.ts` e mude:
```typescript
const DRY_RUN = true; // Para simular
```

Depois execute novamente com:
```typescript
const DRY_RUN = false; // Para executar de verdade
```

## O que o Script Faz

Para cada usuário:

1. **Conta amizades aceitas**: Query por friendships com `status === 'accepted'` e `userId === userId`
2. **Conta solicitações recebidas**: Query por friendships com `status === 'pending'` e `requestedBy !== userId`
3. **Conta solicitações enviadas**: Query por friendships com `status === 'pending'` e `requestedBy === userId`
4. **Atualiza o documento**: Seta os campos `friendsCount`, `pendingRequestsCount`, `sentRequestsCount`

## Segurança

- ✅ Não deleta nenhum dado
- ✅ Apenas adiciona/atualiza campos de contadores
- ✅ Modo dry-run disponível
- ✅ Logs detalhados de todas as operações
- ✅ Tratamento de erros por usuário

## Quando Executar

Execute este script:
- ✅ Após migrar de IDs aleatórios para IDs compostos
- ✅ Quando os contadores de amigos não estiverem corretos na UI
- ✅ Como manutenção periódica se houver inconsistências

## Tempo de Execução

O script processa aproximadamente:
- 1-5 segundos por usuário (depende do número de amizades)
- Para 100 usuários: ~3-8 minutos
- Para 1000 usuários: ~30-80 minutos

## Troubleshooting

### Erro: "Variáveis de ambiente não encontradas"
- Certifique-se que o arquivo `.env` existe na raiz do projeto
- Verifique se todas as variáveis `VITE_FIREBASE_*` estão configuradas

### Contadores ainda incorretos após migração
- Verifique se há operações de amizade acontecendo durante a migração
- Execute o script novamente
- Verifique os logs para erros específicos
