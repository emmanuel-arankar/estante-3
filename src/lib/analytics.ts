import { logEvent } from 'firebase/analytics';
import { analytics } from '@/services/firebase';

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
 */
export type AppEventName =
    | 'login'
    | 'sign_up'
    | 'friend_request_sent'
    | 'friend_request_accepted'
    | 'book_added'
    | 'profile_updated'
    | 'search_performed'
    | 'page_view';

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
