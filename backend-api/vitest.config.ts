// =============================================================================
// CONFIGURAÇÃO DO VITEST (BACKEND-API)
// =============================================================================

import e from 'express';
import { defineConfig } from 'vitest/config';

/**
 * @name Configuração de Testes Vitest
 * @summary Define o ambiente e as regras de cobertura para a suíte de testes.
 * @description Centraliza todas as configurações do executor de testes Vitest,
 * incluindo o ambiente simulado, provedores de cobertura e filtros de inclusão/exclusão.
 * 
 * @note Estratégia de Testes:
 * - **Ambiente Node**: Essencial para testar rotas e serviços que dependem de APIs internas.
 * - **Provider V8**: Escolhido pela alta precisão e performance nativa na geração de relatórios de cobertura.
 * - **Cobertura Seletiva**: Focamos em arquivos de lógica core, excluindo entradas de processo (index.ts) e schemas de validação pura.
 */
export default defineConfig({
  test: {
    // ==== ==== 1. AMBIENTE E GLOBAIS ==== ====
    globals: true,                              // Permite describe/it sem importação
    environment: 'node',                        // Ambiente de execução .ts (Node.js)
    env: {
      FIREBASE_DATABASE_URL: 'https://estante-virtual-805ef-default-rtdb.firebaseio.com',
    },

    // ==== ==== 2. RELATÓRIOS DE COBERTURA ==== ====
    coverage: {
      provider: 'v8',                           // Motor de cobertura nativo de alta performance
      reporter: ['text', 'json', 'html'],       // Formatos: Terminal, JSON (CI) e HTML (Visual)

      // ==== ==== 3. FILTROS DE ARQUIVOS ==== ====
      include: ['src/**/*.ts'],                 // Alvo principal da auditoria de testes
      exclude: [
        'src/index.ts',                         // Ponto de entrada (Bootstrap)
        'src/**/*.schema.ts',                   // Testados implicitamente via integração
        'src/middleware/error.middleware.ts',   // Testado via cenários de erro globais
        // Adicione outros padrões de utilitários isolados se necessário
      ],
    },

    // ==== ==== 4. SETUP E EXTENSÕES ==== ====
    // setupFiles: ['./src/tests/setup.ts'],    // Ative se houver mocks globais necessários
  },
});