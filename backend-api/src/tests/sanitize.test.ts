import { describe, it, expect } from 'vitest';
import { sanitize } from '../lib/sanitize';
import { updateProfileSchema } from '../schemas/user.schema';
import { sendMessageSchema } from '../schemas/chat.schema';

describe('Sanitização de Inputs (XSS Protection)', () => {
    describe('Utilitário sanitize()', () => {
        it('deve remover tags script completas', () => {
            const input = 'Olá <script>alert("xss")</script> mundo';
            expect(sanitize(input)).toBe('Olá mundo');
        });

        it('deve remover tags HTML mas manter o texto', () => {
            const input = '<b>Negrito</b> e <i>Itálico</i>';
            expect(sanitize(input)).toBe('Negrito e Itálico');
        });

        it('deve neutralizar atributos de eventos (onclick, onerror)', () => {
            const input = '<img src=x onerror=alert(1)>';
            // O sanitize remove a tag inteira se allowedTags for vazio
            expect(sanitize(input)).toBe('');
        });

        it('deve neutralizar links javascript:', () => {
            const input = '<a href="javascript:alert(1)">Clique aqui</a>';
            expect(sanitize(input)).toBe('Clique aqui');
        });

        it('deve remover comentários HTML', () => {
            const input = 'Inicio <!-- comentario --> Fim';
            expect(sanitize(input)).toBe('Inicio Fim');
        });
    });

    describe('Integração com Zod Schemas', () => {
        it('deve sanitizar o displayName no updateProfileSchema', async () => {
            const data = { displayName: 'User <script>alert(1)</script>' };
            const result = await updateProfileSchema.parseAsync(data);
            expect(result.displayName).toBe('User');
        });

        it('deve sanitizar a bio no updateProfileSchema', async () => {
            const data = { bio: 'Bio com <img src=x> imagem' };
            const result = await updateProfileSchema.parseAsync(data);
            // sanitizeRichText permite <img>
            expect(result.bio).toBe('Bio com <img src="x"> imagem');
        });

        it('deve sanitizar o conteúdo do chat no sendMessageSchema', async () => {
            const data = {
                receiverId: 'user-123',
                content: 'Hey <iframe src="evil.com"></iframe> check this',
                type: 'text'
            };
            const result = await sendMessageSchema.parseAsync(data);
            expect(result.content).toBe('Hey check this');
        });
    });
});
