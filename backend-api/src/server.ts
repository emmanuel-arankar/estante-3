/**
 * Servidor standalone para desenvolvimento local
 * Permite rodar o backend-api sem Firebase Emulators
 */

// Carrega variáveis de ambiente do .env
import * as path from 'path';
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (error) {
  console.log('⚠️  dotenv não encontrado, usando variáveis de ambiente do sistema');
}

import { app } from './index';

const PORT = process.env.PORT || 3000;

// Inicia o servidor HTTP
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recebido. Encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT recebido. Encerrando servidor...');
  process.exit(0);
});
