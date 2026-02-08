export const ROUTE_PATTERNS = {
  PROFILE: '/profile/:nickname',
  CHAT: '/chat/:receiverId',
};

type RouteParams = {
  profile: { nickname: string };
  chat: { receiverId: string };
};

export const PATHS = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',

  // Rotas de Perfil
  PROFILE_ME: '/profile/me',
  PROFILE_EDIT: '/profile/me/edit',
  PROFILE_BOOKS: 'books',
  PROFILE_REVIEWS: 'reviews',
  PROFILE_FRIENDS: 'friends',
  PROFILE_ACTIVITY: 'activity',

  // Rotas de Amigos
  FRIENDS: '/friends',
  FRIENDS_REQUESTS: 'requests',
  FRIENDS_SENT: 'sent',

  NOTIFICATIONS: '/notifications',
  MESSAGES: '/messages',

  // Rotas de Administração
  ADMIN_DASHBOARD: '/admin',

  // Funções construtoras para rotas dinâmicas
  PROFILE: (params: RouteParams['profile']) => `/profile/${params.nickname}`,
  CHAT: (params: RouteParams['chat']) => `/chat/${params.receiverId}`,
};
