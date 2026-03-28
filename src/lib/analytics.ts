import { logEvent } from 'firebase/analytics';
import { analytics } from '@/services/firebase/firebase';

/**
 * @name AppEventName
 * @description Tipagem estrita baseada no documento METRICS_SETUP_FIREBASE.md
 * @summary Eventos customizados que serão rastreados no Firebase Analytics.
 * 
 * @property login - Evento disparado quando um usuário faz login.
 * @property sign_up - Evento disparado quando um usuário se cadastra.
 * @property friend_request_sent - Evento disparado quando um usuário envia uma solicitação de amizade.
 * @property friend_request_accepted - Evento disparado quando um usuário aceita uma solicitação de amizade.
 * @property book_added - Evento disparado quando um usuário adiciona um livro.
 * @property profile_updated - Evento disparado quando um usuário atualiza seu perfil.
 * @property search_performed - Evento disparado quando um usuário realiza uma busca.
 * @property page_view - Evento disparado quando um usuário visualiza uma página.
 * @property review_created - Evento disparado quando um usuário cria uma avaliação.
 * @property review_liked - Evento disparado quando um usuário curte uma avaliação.
 * @property comment_created - Evento disparado quando um usuário cria um comentário.
 * @property comment_liked - Evento disparado quando um usuário curte um comentário.
 * @property book_viewed - Evento disparado quando um usuário abre a página de um livro.
 * @property author_viewed - Evento disparado quando um usuário abre a página de um autor.
 * @property book_searched - Evento disparado quando um usuário busca um livro e clica em resultado.
 * @property book_searched_empty - Evento disparado quando uma busca não retorna resultados.
 * @property shelf_added - Evento disparado quando um usuário adiciona um livro à estante.
 */
export type AppEventName =
    | 'login'
    | 'sign_up'
    | 'friend_request_sent'
    | 'friend_request_accepted'
    | 'book_added'
    | 'profile_updated'
    | 'search_performed'
    | 'page_view'
    | 'review_created'
    | 'review_liked'
    | 'comment_created'
    | 'comment_liked'
    | 'book_viewed'
    | 'author_viewed'
    | 'book_searched'
    | 'book_searched_empty'
    | 'shelf_added';

/**
 * @name trackEvent
 * @description Registra um evento customizado no Firebase Analytics.
 * @summary Falha de forma silenciosa se o Analytics não estiver disponível (ex: bloqueadores de anúncio).
 * 
 * @param eventName - Nome do evento a ser registrado.
 * @param eventParams - Parâmetros do evento.
 */
export const trackEvent = (eventName: AppEventName, eventParams?: Record<string, any>) => {
    if (!analytics) return;
    try {
        logEvent(analytics, eventName as any, eventParams);
    } catch (error) {
        console.warn(`[Analytics] Falha ao registrar evento ${eventName}:`, error);
    }
};