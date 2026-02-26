import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * @name Async Handler Wrapper
 * @summary Captura erros em funções assíncronas e repassa para o next().
 * @description Remove a verbosidade de try/catch nas rotas do Express. 
 * Qualquer erro lançado dentro de uma função embrulhada por este handler 
 * será automaticamente capturado e enviado para o middleware de tratamento de erro global.
 * 
 * @param {RequestHandler} fn - A função assíncrona da rota.
 * @returns {RequestHandler} A função embrulhada.
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
