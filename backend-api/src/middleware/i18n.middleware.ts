import { Request, Response, NextFunction } from 'express';
import { LocaleCode, DEFAULT_LOCALE, locales } from '../locales';

/**
 * Interface estendida para incluir o idioma detectado.
 */
export interface I18nRequest extends Request {
    locale: LocaleCode;
}

/**
 * @name Middleware de Internacionalização (i18n)
 * @summary Detecta o idioma do usuário via headers.
 * @description Analisa o cabeçalho 'Accept-Language' e define o locale da requisição.
 * Se o idioma não for suportado, utiliza o padrão (pt-BR).
 */
export const i18nMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const acceptLanguage = req.get('Accept-Language');
    let detectedLocale: LocaleCode = DEFAULT_LOCALE;

    if (acceptLanguage) {
        // Pega o primeiro idioma da lista (ex: "en-US,en;q=0.9,pt-BR;q=0.8")
        const primaryLang = acceptLanguage.split(',')[0].split(';')[0].trim();

        // Verifica se temos este idioma (ou uma versão simplificada dele)
        if (locales[primaryLang as LocaleCode]) {
            detectedLocale = primaryLang as LocaleCode;
        } else {
            // Tenta apenas a parte principal (ex: de 'en-GB' para 'en')
            const baseLang = primaryLang.split('-')[0] as LocaleCode;
            if (locales[baseLang]) {
                // Mapeia idiomas base para o nosso código específico se necessário
                // (No nosso caso, 'en' mapeia para 'en-US' no locales/index.ts)
                detectedLocale = baseLang;
            }
        }
    }

    // Injeta o locale no request para uso posterior
    (req as I18nRequest).locale = detectedLocale;

    // Também injeta em res.locals para acesso em templates (se houver)
    res.locals.locale = detectedLocale;

    next();
};
