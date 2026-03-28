import { auth } from '@/services/firebase/firebase';

interface ApiClientOptions extends RequestInit {
  data?: any;
}

/**
 * Cliente API centralizado que injeta automaticamente o token de autenticação
 * e trata respostas de erro padrão.
 */
export const apiClient = async <T = any>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> => {
  const { data, headers: customHeaders, ...customOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // 1. Injetar Token de Autenticação se disponível
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      (headers as any)['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('Falha ao obter token de autenticação:', error);
      // Prossegue sem token, pode ser uma rota pública ou usar cookie
    }
  }

  // 2. Configurar Body se houver dados
  const config: RequestInit = {
    method: 'GET',
    credentials: 'include', // Mantém suporte a cookies como fallback
    headers,
    ...customOptions,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  // 3. Executar Requisição
  // Garante que o endpoint comece com /api se não começar (opcional, mas seguro)
  const url = endpoint.startsWith('http') || endpoint.startsWith('/api')
    ? endpoint
    : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, config);

  // 4. Tratar Resposta
  if (!response.ok) {
    let errorMessage = `Erro da API (${response.status})`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorData.error?.error || errorData.message || errorData.error || errorMessage;

      if (typeof errorMessage === 'object') {
        errorMessage = JSON.stringify(errorMessage);
      }
    } catch (e) {
      // Falha ao ler JSON, usa status text
      errorMessage = `${errorMessage}: ${response.statusText}`;
    }

    // Lança erro com propriedade status para facilitar tratamento
    const error: any = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  // Retorna vazio se 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  try {
    const json = await response.json();

    // 5. Suporte ao Contrato de Resposta Padronizado (Fase 11)
    // Se a resposta vier no formato { status: 'success', data: ... }, extraímos o data automaticamente.
    if (json && json.status === 'success' && 'data' in json) {
      return json.data as T;
    }

    return json as T;
  } catch (e) {
    // Se não for JSON (ex: blob ou texto), retorna como está se possível ou vazio
    return {} as T;
  }
};
