import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
// import express from 'express';
// import { https } from 'firebase-functions';

import { app } from '../index';

// Mock do logger
vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

describe('Health Check Endpoint', () => {
  // let server: https.HttpsFunction;
  // beforeAll(() => {
  //   server = https.onRequest(app);
  // });
  
  it('GET /api/health should return 200 OK', async () => {
    const response = await request(app)
      .get('/api/health'); // Rota completa
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(Date.parse(response.body.timestamp)).not.toBeNaN();
  });
});