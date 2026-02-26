// =============================================================================
// CONFIGURAÇÕES E IMPORTS DE TESTE (AUTENTICAÇÃO)
// =============================================================================

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { admin, db } from '../firebase';

// Define chave de API de teste para evitar erros de inicialização
process.env.FIREBASE_API_KEY = 'test_key';

// =============================================================================
// MOCKS ELEVADOS (HOISTED)
// =============================================================================

/**
 * @name Mock Firebase Auth
 * @summary Simulação do Firebase Admin e Firestore.
 * @description Mocks elevados para o {@link admin.auth} e {@link db}. 
 * Define o comportamento básico de autenticação e transações para os testes de autenticação, 
 * simulando criação de usuário e verificação de apelido único.
 * 
 * @returns {Object} Contém os mocks hoisted (adminAuthMock, dbMock, transactionMock)
 * @example
 * // Acessando o mock via hoist
 * vi.mocked(admin.auth().createUser).mockResolvedValueOnce({ uid: 'user123' } as any);
 */
const { adminAuthMock, dbMock, transactionMock } = vi.hoisted(() => {
  const adminAuthMock = {
    createUser: vi.fn(),
    createCustomToken: vi.fn(),
    deleteUser: vi.fn(),
    verifyIdToken: vi.fn(),
  };

  const transactionMock = {
    get: vi.fn(),
    set: vi.fn(),
  };

  const dbMock = {
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn((id) => ({ __id: id, get: vi.fn(), set: vi.fn(), update: vi.fn() })),
    get: vi.fn(),
    runTransaction: vi.fn((callback) => callback(transactionMock)),
  };

  return { adminAuthMock, dbMock, transactionMock };
});

/** 
 * @name Mock de Integração Firebase
 * @summary Vinculação do Admin SDK com mocks hoisted.
 * @description Substitui as exportações reais do módulo de inicialização do Firebase 
 * pelos mocks definidos na fase de 'hoisting' do Vitest ({@link adminAuthMock} e {@link dbMock}).
 */
vi.mock('../firebase', () => ({
  admin: {
    auth: () => adminAuthMock,
    firestore: {
      Timestamp: {
        now: vi.fn(() => ({ toMillis: () => Date.now() })),
      },
    },
  },
  auth: adminAuthMock,
  db: dbMock,
}));

// =============================================================================
// MOCKS DE MÓDULOS E MIDDLEWARES
// =============================================================================

/**
 * @name Mock Logger
 * @summary Silenciador de logs de funções.
 * @description Evita poluição no console durante a execução dos testes, mockando todas as funções do {@link logger}.
 */
vi.mock('firebase-functions/logger', () => ({
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  write: vi.fn(),
}));

/**
 * @name Ambiente de Teste de Autenticação
 * @summary Configuração e ciclo de vida.
 * @description Centraliza o setup global para os testes de autenticação, 
 * incluindo o stubbing do fetch global para interceptar chamadas à API de Identidade do Firebase.
 * 
 * @note Lógica de Mock:
 * - Intercepta chamadas fetch para simular respostas da API do Firebase.
 * - Limpa todos os mocks entre os testes para garantir isolamento.
 */
describe('Ambiente de Teste de Autenticação', () => {
  const mockFetch = vi.fn();

  beforeAll(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==== ==== CASOS DE TESTE (AUTH) ==== ====

  /**
   * @name Testes de Registro
   * @summary Validação do fluxo de criação de conta.
   * @description Cobre cenários de sucesso, erro de validação (Zod) e conflitos de dados existentes.
   */
  describe('POST /api/register', () => {
    /**
     * @test Registro de Sucesso
     * @summary Criação de conta válida.
     * @description Garante que o fluxo feliz de registro cria o usuário no Auth e no Firestore corretamente.
     * 
     * @example
     * // Trigger do registro
     * const response = await request(app).post('/api/register').send({ ... });
     * expect(response.status).toBe(201);
     */
    it('deve registrar um novo usuário com sucesso', async () => {
      // [ARRANGE] Configurar mocks de autenticação do Firebase
      vi.mocked(admin.auth().createUser).mockResolvedValueOnce({ uid: 'user123' } as any);
      vi.mocked(admin.auth().createCustomToken).mockResolvedValueOnce('mocked-custom-token');

      // [ARRANGE] Configurar mocks de banco de dados (Simular nickname disponível)
      const mockDoc = { exists: false };
      vi.mocked(transactionMock.get).mockResolvedValue(mockDoc);

      // [ACT] Executar a requisição para a rota de registro {@link registerSchema}
      const response = await request(app)
        .post('/api/register')
        .send({
          email: 'test@estante.com',
          password: 'password123',
          displayName: 'Test User'
        });

      // [ASSERT] Verificações de sucesso e chamadas de API
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('customToken', 'mocked-custom-token');
      expect(admin.auth().createUser).toHaveBeenCalledWith({
        email: 'test@estante.com',
        password: 'password123',
        displayName: 'Test User'
      });
    });

    /**
     * @test Colisão de Nickname
     * @summary Geração de sufixo automático.
     * @description Verifica se o sistema incrementa o nickname caso o original (base) já esteja em uso por outro usuário.
     * 
     * @example
     * // Senha curta
     * const response = await request(app).post('/api/register').send({ ... });
     * expect(response.status).toBe(400);
     */
    it('deve gerar um nickname com sufixo se o principal estiver ocupado', async () => {
      vi.mocked(admin.auth().createUser).mockResolvedValueOnce({ uid: 'user456' } as any);
      vi.mocked(admin.auth().createCustomToken).mockResolvedValueOnce('token-456');

      // Simular que 'testuser' já existe, mas 'testuser-1' está disponível
      vi.mocked(transactionMock.get)
        .mockResolvedValueOnce({ exists: true }) // 'testuser' ocupado
        .mockResolvedValueOnce({ exists: false }); // 'testuser-1' disponível

      const response = await request(app)
        .post('/api/register')
        .send({
          email: 'new@estante.com',
          password: 'password123',
          displayName: 'Test User'
        });

      expect(response.status).toBe(201);
      // O nickname gerado deve ser 'testuser-1'
      expect(response.body.data).toHaveProperty('customToken', 'token-456');
    });

    /**
     * @test Registro Inválido
     * @summary Falha de validação via Zod.
     * @description Verifica se payloads malformados (ex: senha curta ou e-mail inválido) são rejeitados antes da lógica de negócio.
     * 
     * @example
     * // Envio de senha muito curta
     * const response = await request(app).post('/api/register').send({ password: '123' });
     * expect(response.status).toBe(400);
     */
    it('deve falhar se os dados da requisição forem inválidos', async () => {
      // [ACT] Enviar payload malformado que viola o {@link registerSchema}
      const response = await request(app)
        .post('/api/register')
        .send({ email: 'invalid', password: '123' }); // Senha muito curta, falta nome

      // [ASSERT] Deve disparar erro de validação (ZodError) capturado pelo {@link errorHandler}
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('error', 'Dados inválidos na requisição');
      expect(response.body.error).toHaveProperty('details');
    });
  });

  /**
   * @name Testes de Login
   * @summary Validação do fluxo de autenticação.
   * @description Verifica o login com email/senha contra a API do Firebase e o tratamento de credenciais.
   */
  describe('POST /api/login', () => {
    /**
     * @test Login de Sucesso
     * @summary Autenticação válida.
     * @description Garante a geração de um custom token após verificação bem-sucedida de credenciais.
     * 
     * @example
     * // Login de usuário existente
     * const response = await request(app).post('/api/login').send({ email, password });
     * expect(response.body).toHaveProperty('customToken');
     */
    it('deve fazer login com sucesso e retornar o custom token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ localId: 'user123', idToken: 'some-id-token' }),
      } as any);

      vi.mocked(admin.auth().createCustomToken).mockResolvedValueOnce('mock-custom-token');

      const response = await request(app)
        .post('/api/login')
        .send({
          email: 'test@estante.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('customToken', 'mock-custom-token');
    });

    /**
     * @test Login com Erro
     * @summary Falha de credenciais.
     * @description Simula a rejeição da API de Auth do Firebase (senha incorreta) e valida o código 401.
     * 
     * @example
     * // Senha incorreta
     * const response = await request(app).post('/api/login').send({ ... });
     * expect(response.status).toBe(401);
     */
    it('deve retornar 401 com credenciais inválidas', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'INVALID_PASSWORD' }
        }),
      } as any);

      const response = await request(app)
        .post('/api/login')
        .send({
          email: 'test@estante.com',
          password: 'wrongpassword'
        });


      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty('error', 'E-mail ou senha inválidos.');
    });
  });

  /**
   * @name Testes de Recuperação de Senha
   * @summary Fluxo de redefinição via e-mail.
   * @description Testa o envio de solicitações de reset de senha e o comportamento para e-mails inexistentes.
   */
  describe('POST /api/recover', () => {
    /**
     * @test Solicitar Recuperação
     * @summary Disparo de e-mail de reset.
     * @description Valida a integração com o serviço de envio de e-mails de recuperação do Firebase.
     * 
     * @example
     * // Solicitação válida
     * await request(app).post('/api/recover').send({ email: 'user@test.com' });
     */
    it('deve disparar o envio de email de recuperação com sucesso', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'test@estante.com' }),
      } as any);

      const response = await request(app)
        .post('/api/recover')
        .send({ email: 'test@estante.com' });


      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('message', 'E-mail enviado');
    });

    /**
     * @test Recuperação Inexistente
     * @summary Erro 404 para e-mail não cadastrado.
     * @description Garante que o sistema informa quando o e-mail fornecido não está na base de dados do Firebase.
     * 
     * @example
     * const res = await request(app).post('/api/recover').send({ email: 'ghost@test.com' });
     * expect(res.status).toBe(404);
     */
    it('deve retornar 404 se o email não for encontrado', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'EMAIL_NOT_FOUND' }
        }),
      } as any);

      const response = await request(app)
        .post('/api/recover')
        .send({ email: 'notfound@estante.com' });

      expect(response.status).toBe(404);
      expect(response.body.error).toHaveProperty('error', 'Nenhum usuário encontrado com este e-mail.');
    });
  });

  /**
   * @name Testes de Login com Google
   * @summary Integração com OAuth2/Google Auth.
   * @description Cobre cenários de primeiro login (provisionamento) e logins subsequentes (re-autenticação).
   */
  describe('POST /api/google', () => {
    /**
     * @test Provisionamento Google (Novo Usuário)
     * @summary Criação automática de perfil.
     * @description Verifica se o sistema cria os documentos necessários no Firestore durante o primeiro login via Google.
     * 
     * @example
     * const res = await request(app).post('/api/google').send({ uid: 'new_g_user', ... });
     * expect(res.status).toBe(201);
     * expect(res.body.isNewUser).toBe(true);
     */
    it('deve criar documento de perfil se o usuário Google for novo', async () => {
      // Configura mocks para simular documento não existente
      vi.mocked(db.doc).mockReturnThis();
      vi.mocked((db as any).get).mockResolvedValueOnce({ exists: false } as any);

      vi.mocked(transactionMock.get).mockResolvedValue({ exists: false });

      const response = await request(app)
        .post('/api/google')
        .send({
          uid: 'googleUser123',
          email: 'google@test.com',
          displayName: 'Google User',
          photoURL: 'http://photo.url'
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('isNewUser', true);
      expect(db.runTransaction).toHaveBeenCalled();
    });

    /**
     * @test Login Google Recorrente
     * @summary Re-autenticação de usuário existente.
     * @description Garante que usuários que já possuem perfil não sofram nova criação de documentos (operações idempotentes).
     * 
     * @example
     * const res = await request(app).post('/api/google').send({ uid: 'existing_g_user', ... });
     * expect(res.status).toBe(200);
     * expect(res.body.isNewUser).toBe(false);
     */
    it('deve retornar 200 (Sucesso) se o perfil do usuário Google já existir', async () => {
      // Configura mocks para simular documento existente
      vi.mocked(db.doc).mockReturnThis();
      vi.mocked((db as any).get).mockResolvedValueOnce({ exists: true } as any);

      const response = await request(app)
        .post('/api/google')
        .send({
          uid: 'googleUser123',
          email: 'google@test.com',
          displayName: 'Google User'
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('isNewUser', false);
      expect(db.runTransaction).not.toHaveBeenCalled();
    });
  });
});
