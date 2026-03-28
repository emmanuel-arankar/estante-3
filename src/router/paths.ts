export const ROUTE_PATTERNS = {
  PROFILE: '/profile/:nickname',
  CHAT: '/chat/:receiverId',
  BOOK_PAGE: '/book/:editionId',
  AUTHOR_PAGE: '/author/:personId',
  GROUP_PAGE: '/group/:groupId',
  WORK_REDIRECT: '/work/:workId',
  WORK_EDITIONS: '/work/:workId/editions',
  SERIES_PAGE: '/series/:seriesId',
};

type RouteParams = {
  profile: { nickname: string };
  chat: { receiverId: string };
  book: { editionId: string };
  author: { personId: string };
  group: { groupId: string };
  work: { workId: string };
  series: { seriesId: string };
};

export const PATHS = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',

  // Busca Global
  SEARCH: '/search',

  // Rotas de Livros e Autores
  BOOKS_SEARCH: '/books/search',

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

  // Rotas de Curadoria (Bibliotecário)
  CURATOR_DASHBOARD: '/curatorship',
  CURATOR_EDIT_WORK: (params: RouteParams['work']) => `/curator/work/${params.workId}/edit`,
  CURATOR_EDIT_EDITION: (params: RouteParams['book']) => `/curator/edition/${params.editionId}/edit`,
  CURATOR_EDIT_PERSON: (params: RouteParams['author']) => `/curator/person/${params.personId}/edit`,
  CURATOR_EDIT_PUBLISHER: (params: { publisherId: string }) => `/curator/publisher/${params.publisherId}/edit`,

  // Funções construtoras para rotas dinâmicas
  SETTINGS_BLOCKED: '/settings/blocked',
  PROFILE: (params: RouteParams['profile']) => `/profile/${params.nickname}`,
  CHAT: (params: RouteParams['chat']) => `/chat/${params.receiverId}`,
  BOOK: (params: RouteParams['book']) => `/book/${params.editionId}`,
  AUTHOR: (params: RouteParams['author']) => `/author/${params.personId}`,
  GROUP: (params: RouteParams['group']) => `/group/${params.groupId}`,
  WORK: (params: RouteParams['work']) => `/work/${params.workId}`,
  WORK_EDITIONS: (params: RouteParams['work']) => `/work/${params.workId}/editions`,
  SERIES: (params: RouteParams['series']) => `/series/${params.seriesId}`,
};
