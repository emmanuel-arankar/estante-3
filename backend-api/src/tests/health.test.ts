// =============================================================================
// CONFIGURAÇÕES E IMPORTS DE TESTE (HEALTH CHECK)
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// =============================================================================
// MOCKS ELEVADOS (HOISTED)
// =============================================================================

vi.mock('../firebase', () => ({
  admin: {
    auth: vi.fn(),
    firestore: vi.fn(),
    database: vi.fn(),
    storage: vi.fn(),
  },
  db: {
    collection: vi.fn(),
  },
  rtdb: {
    ref: vi.fn(),
  },
  auth: {
    verifySessionCookie: vi.fn(),
  },
  bucket: {
    file: vi.fn(),
  }
}));

import { app } from '../index';

// =============================================================================
// MOCKS DE MÓDULOS E MIDDLEWARES
// =============================================================================

/**
 * @name Mock Logger
 * @summary Silenciador de logs para integridade.
 * @description Evita ruídos de log no terminal durante a execução dos testes de saúde.
 */
vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// =============================================================================
// SETUP DE TESTES (TEST SETUP)
// =============================================================================

// Sem setup adicional necessário.

// =============================================================================
// TESTES DOS ENDPOINTS DO MÓDULO (HEALTH)
// =============================================================================

/**
 * @name Verificação de Integridade
 * @summary Teste básico de disponibilidade da API.
 * @description Testa a integridade do sistema verificando se o endpoint de saúde retorna status 200 OK.
 * 
 * @example
 * const res = await request(app).get('/api/health');
 * expect(res.status).toBe(200);
 */
describe('Endpoint de Health Check', () => {
  /**
   * @test Disponibilidade da API
   * @summary Resposta 200 OK.
   * @description Garante que o gateway principal da API esteja operacional e retornando o status de sistema correto.
   * 
   * @example
   * const res = await request(app).get('/api/health');
   * expect(res.status).toBe(200);
   * expect(res.body.status).toBe('ok');
   */
  it('GET /api/health deve retornar status 200 OK', async () => {
    const response = await request(app)
      .get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('status', 'ok');
    expect(response.body.data).toHaveProperty('timestamp');
    expect(Date.parse(response.body.data.timestamp)).not.toBeNaN();
  });
});