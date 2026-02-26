import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as logger from 'firebase-functions/logger';

/**
 * @name Middleware de Validação Genérico
 * @summary Validação de entradas via Zod.
 * @description Intercepta a requisição e valida body, query e params contra schemas Zod específicos.
 * Se houver erro, retorna 400 com os detalhes formatados.
 * 
 * @params {Object} schemas - Objeto contendo schemas para body, query e params
 * @returns {Function} Middleware Express
 * 
 * @example
 * router.post('/user', validate({ body: userSchema }), (req, res) => { ... });
 */
export const validate = (schemas: { body?: z.ZodTypeAny, query?: z.ZodTypeAny, params?: z.ZodTypeAny }) =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }
            if (schemas.query) {
                req.query = await schemas.query.parseAsync(req.query) as any;
            }
            if (schemas.params) {
                req.params = await schemas.params.parseAsync(req.params) as any;
            }

            return next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.warn('Falha na validação de entrada', {
                    path: req.path,
                    errors: error.flatten().fieldErrors
                });

                return res.status(400).json({
                    error: 'Dados inválidos na requisição',
                    details: error.flatten().fieldErrors,
                });
            }

            logger.error('Erro inesperado no middleware de validação', error);
            return next(error);
        }
    };
