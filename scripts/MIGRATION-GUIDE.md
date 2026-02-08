# Guia Completo de Migração - Sistema de Amizades

Este guia mostra a ordem correta para executar todas as migrações do sistema de amizades.

## Ordem de Execução

### 1️⃣ Migração de IDs Compostos (Se necessário)
**Status**: ✅ Provavelmente já executado
**Quando executar**: Apenas se você ainda tem documentos com IDs aleatórios

```bash
npm run migrate:friendships
```

📖 Documentação: [README-MIGRATION.md](./README-MIGRATION.md)

---

### 2️⃣ Inicialização de Contadores de Usuário
**Status**: ⚠️ IMPORTANTE - Execute primeiro
**Por quê**: Corrige o bug de contadores de amigos não atualizarem

```bash
npm run migrate:counters
```

**O que faz**:
- Inicializa `friendsCount`, `pendingRequestsCount`, `sentRequestsCount`
- Conta as amizades reais e atualiza os campos
- Corrige contadores incorretos (ex: -1, 0 quando deveria ser maior)

📖 Documentação: [README-COUNTERS-MIGRATION.md](./README-COUNTERS-MIGRATION.md)

**Tempo estimado**:
- 100 usuários: ~3-8 minutos
- 1000 usuários: ~30-80 minutos

---

### 3️⃣ Adicionar Amigos em Comum às Solicitações Pendentes
**Status**: 🆕 Execute agora
**Por quê**: Permite que solicitações antigas mostrem amigos em comum

```bash
npm run migrate:mutual-friends
```

**O que faz**:
- Calcula amigos em comum para cada solicitação pendente
- Adiciona o campo `mutualFriendsCount`
- Atualiza ambos os documentos de cada par

📖 Documentação: [README-MUTUAL-FRIENDS-MIGRATION.md](./README-MUTUAL-FRIENDS-MIGRATION.md)

**Tempo estimado**:
- 50 solicitações: ~30-60 segundos
- 100 solicitações: ~1-2 minutos

---

## Passo a Passo Recomendado

### ✅ Checklist de Execução

```bash
# 1. Verificar ambiente
# Certifique-se que o arquivo .env existe e tem as credenciais

# 2. Executar migração de contadores (PRIMEIRO)
npm run migrate:counters

# Aguardar conclusão, verificar logs
# Espera: "✅ Migração concluída com sucesso!"

# 3. Executar migração de amigos em comum (SEGUNDO)
npm run migrate:mutual-friends

# Aguardar conclusão, verificar logs
# Espera: "✅ Migração concluída com sucesso!"

# 4. Testar a aplicação
# - Verificar se contadores de amigos estão corretos
# - Criar nova solicitação de amizade
# - Verificar se tooltip de amigos em comum funciona
```

---

## Após as Migrações

### Funcionalidades Que Devem Funcionar

1. **Contadores de Amigos**
   - ✅ Número correto de amigos na página
   - ✅ Contador atualiza ao adicionar/remover amigos
   - ✅ Contador não fica negativo ou zero incorretamente

2. **Amigos em Comum**
   - ✅ Contador aparece em solicitações pendentes
   - ✅ Tooltip mostra nomes ao passar o mouse
   - ✅ Funciona para solicitações antigas e novas

3. **Ações em Massa**
   - ✅ Aceitar/Recusar todas as solicitações
   - ✅ Cancelar todas as solicitações enviadas
   - ✅ Botões com cores corretas

---

## Troubleshooting

### Problema: "Variáveis de ambiente não encontradas"
**Solução**:
- Certifique-se que `.env` existe na raiz do projeto
- Verifique se todas as variáveis `VITE_FIREBASE_*` estão definidas

### Problema: Script trava ou demora muito
**Solução**:
- Normal para muitos usuários/solicitações
- Aguarde a conclusão (verifique os logs de progresso)
- Execute em horário de baixo tráfego

### Problema: Contadores ainda incorretos após migração
**Solução**:
- Execute `npm run migrate:counters` novamente
- Verifique os logs para erros específicos
- Confirme que não há operações de amizade acontecendo durante a migração

### Problema: Tooltip não mostra nomes
**Solução**:
- Verifique o console do navegador (F12) para erros
- Confirme que `mutualFriendsCount > 0` no documento
- Execute `npm run migrate:mutual-friends` novamente

---

## Modo Dry Run (Simulação)

Todos os scripts suportam modo de simulação. Para testar antes de executar:

1. Edite o arquivo do script (`.ts`)
2. Mude `const DRY_RUN = false;` para `const DRY_RUN = true;`
3. Execute o comando
4. Revise os logs
5. Mude de volta para `false` e execute novamente

---

## Suporte

Se encontrar problemas:

1. Verifique os logs detalhados no console
2. Leia a documentação específica de cada script
3. Execute em modo dry-run primeiro
4. Verifique o Firestore Console para confirmar mudanças

---

## Resumo

| Script | Ordem | Obrigatório | Tempo (100 docs) |
|--------|-------|-------------|------------------|
| migrate:friendships | 1 | Apenas se IDs aleatórios | ~5-10 min |
| migrate:counters | 2 | ✅ Sim | ~3-8 min |
| migrate:mutual-friends | 3 | ✅ Sim | ~1-2 min |

**Total estimado**: ~5-10 minutos para ~100 documentos
