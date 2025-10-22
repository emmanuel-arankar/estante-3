import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,                              // Permite usar describe, it, expect, etc. sem importar
    environment: 'node',                        // Define o ambiente de teste como Node.js
    coverage: {
      provider: 'v8',                           // Usa o provider V8 (nativo do Node) para cobertura
      reporter: ['text', 'json', 'html'],       // Formatos do relatório de cobertura
      include: ['src/**/*.ts'],                 // Inclui todos os arquivos .ts dentro de src
      exclude: [                                // Exclui arquivos que não fazem sentido testar diretamente
        'src/index.ts',                         // Geralmente difícil de testar unitariamente
        'src/**/*.schema.ts',                   // Schemas são testados indiretamente
        'src/middleware/error.middleware.ts',   // Handlers de erro são testados via integração
        // Adicione outros padrões se necessário
      ],
    },
    // Se precisar de setup files (ex: para mocks globais), descomente:
    // setupFiles: ['./src/tests/setup.ts'],
  },
});