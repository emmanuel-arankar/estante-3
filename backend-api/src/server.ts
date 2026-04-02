// ==== ==== CARREGAR VARIÁVEIS DE AMBIENTE ANTES DE TUDO ==== ====
import * as path from 'path';
import dotenv from 'dotenv';
try {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
} catch {
  console.log('⚠️  dotenv não encontrado, usando variáveis de ambiente do sistema');
}

// =============================================================================
// SERVIDOR STANDALONE (DESENVOLVIMENTO)
// =============================================================================

/**
 * @name Servidor Standalone
 * @summary Servidor Express para desenvolvimento local.
 * @description Servidor standalone para desenvolvimento local.
 * Permite rodar o backend-api sem a necessidade do Firebase Functions Emulator.
 * 
 * @example
 * npm run dev:server
 */

import { app } from './index';

const PORT = process.env.PORT || 3000;

// =============================================================================
// INICIALIZAÇÃO DO SERVIDOR (STARTUP)
// =============================================================================

// ==== ==== INICIALIZAÇÃO DO SERVIDOR (STARTUP) ==== ====
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  🚀 Backend API rodando em modo STANDALONE             ║
║                                                        ║
║  📍 URL: http://localhost:${PORT}                         ║
║  🔥 Firebase: PRODUÇÃO (dados reais)                   ║
║  🛠️  Ambiente: DESENVOLVIMENTO                          ║
║                                                        ║
║  Rotas disponíveis:                                    ║
║  - GET  /api/health                                    ║
║  - POST /api/session-login                             ║
║  - POST /api/session-logout                            ║
║  - GET  /api/friends/*                                 ║
║  - POST /api/friends/*                                 ║
╚════════════════════════════════════════════════════════╝
  `);
});

// =============================================================================
// ENCERRAMENTO GRACIOSO (SHUTDOWN)
// =============================================================================

// ==== ==== GERENCIAMENTO DE SINAIS (SHUTDOWN) ==== ====
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recebido. Encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT recebido. Encerrando servidor...');
  process.exit(0);
});
