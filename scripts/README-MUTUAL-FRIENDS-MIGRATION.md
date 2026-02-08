# Migração de Amigos em Comum

## Problema

Solicitações de amizade criadas antes da implementação do recurso de amigos em comum não possuem o campo `mutualFriendsCount`. Este campo só é calculado automaticamente para novas solicitações.

## Solução

Este script calcula e adiciona o campo `mutualFriendsCount` a todas as solicitações pendentes existentes no Firestore.

## Como Executar

### 1. Executar a Migração

```bash
npm run migrate:mutual-friends
```

O script está configurado com `DRY_RUN = false` por padrão, então executará as atualizações imediatamente.

### 2. Testar Primeiro (Opcional)

Se quiser simular antes de executar:

1. Edite `scripts/add-mutual-friends-to-pending.ts`
2. Mude `const DRY_RUN = false;` para `const DRY_RUN = true;`
3. Execute `npm run migrate:mutual-friends`
4. Revise os resultados
5. Mude de volta para `false` e execute novamente

## O que o Script Faz

Para cada solicitação de amizade pendente:

1. **Identifica pares únicos**: Agrupa documentos por par de usuários (evita processar o mesmo par duas vezes)
2. **Calcula amigos em comum**:
   - Busca todos os amigos aceitos de ambos os usuários
   - Identifica amigos que aparecem em ambas as listas
   - Conta o total
3. **Atualiza documentos**: Adiciona o campo `mutualFriendsCount` a AMBOS os documentos do par
   - Documento do solicitante (`userId_friendId`)
   - Documento do destinatário (`friendId_userId`)

## Exemplo de Saída

```
🚀 Iniciando migração de amigos em comum...

📝 Modo: EXECUÇÃO REAL

📊 Buscando solicitações pendentes...
✅ Encontradas 24 solicitações pendentes

📝 Encontrados 12 pares únicos de usuários

👥 Par: a1b2c3d4... ↔ e5f6g7h8...
   Amigos em comum: 3
   ✅ 2 documento(s) atualizado(s)

👥 Par: i9j0k1l2... ↔ m3n4o5p6...
   Amigos em comum: 0
   ✅ 2 documento(s) atualizado(s)

...

==================================================
📊 RESUMO DA MIGRAÇÃO
==================================================
Pares processados: 12
Documentos atualizados: 24
Erros: 0
==================================================

✅ Migração concluída com sucesso!
```

## Impacto

### Antes
- Solicitações pendentes não mostram amigos em comum
- Tooltip não funciona para solicitações antigas

### Depois
- Todas as solicitações (antigas e novas) mostram o contador
- Tooltip funciona para todas as solicitações
- UX consistente em todo o sistema

## Segurança

- ✅ Apenas adiciona/atualiza o campo `mutualFriendsCount`
- ✅ Não modifica outros campos
- ✅ Não deleta nenhum dado
- ✅ Modo dry-run disponível
- ✅ Tratamento de erros por par
- ✅ Logs detalhados

## Performance

- Processa ~2-5 pares por segundo (depende do número de amigos)
- Para 50 solicitações pendentes: ~30-60 segundos
- Para 100 solicitações pendentes: ~1-2 minutos

## Quando Executar

Execute este script:
- ✅ Após implementar o recurso de amigos em comum
- ✅ Sempre que houver solicitações antigas sem o contador
- ✅ Como manutenção se novos documentos forem criados manualmente

## Após a Migração

Depois de executar este script:

1. **Novas solicitações**: Continuarão sendo criadas automaticamente com `mutualFriendsCount`
2. **Solicitações migradas**: Agora têm o campo e funcionarão normalmente
3. **Tooltip**: Funcionará para todas as solicitações ao passar o mouse

## Troubleshooting

### Erro: "Variáveis de ambiente não encontradas"
- Certifique-se que `.env` existe na raiz do projeto
- Verifique se todas as variáveis `VITE_FIREBASE_*` estão configuradas

### Contador mostra 0 mas deveria ter amigos em comum
- Verifique se as amizades estão com `status === 'accepted'`
- Execute novamente o script
- Verifique os logs para erros específicos

### Script muito lento
- Normal para muitas solicitações pendentes
- Cada par requer 2 queries ao Firestore
- Considere executar em horário de baixo tráfego
