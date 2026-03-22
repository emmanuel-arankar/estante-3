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
            const input = '<div>Texto</div> <b>Negrito</b>';
            expect(sanitize(input)).toBe('Texto Negrito');
        });

        it('deve neutralizar atributos de eventos (onclick, onerror)', () => {
            const input = '<img src=x onerror=alert(1) onclick="console.log(2)">';
            // Como removemos <...>, o resultado deve ser vazio,
            // mas testamos a regex de atributos em strings que não parecem tags
            const rawAttr = 'onclick=alert(1)';
            expect(sanitize(rawAttr)).toBe('x-event=alert(1)');
        });

        it('deve neutralizar links javascript:', () => {
            const input = 'Clique aqui: javascript:alert(1)';
            expect(sanitize(input)).toBe('Clique aqui: x-javascript:alert(1)');
        });

        it('deve remover comentários HTML', () => {
            const input = 'Inicio <!-- comentario --> Fim';
            expect(sanitize(input)).toBe('Inicio Fim');
        });
    });

    describe('Integração com Zod Schemas', () => {
        it('deve sanitizar o displayName no updateProfileSchema', async () => {
            const data = { displayName: 'Hacker <script>evil()</script>' };
            const result = await updateProfileSchema.parseAsync(data);
            expect(result.displayName).toBe('Hacker');
        });

        it('deve sanitizar a bio no updateProfileSchema', async () => {
            const data = { bio: 'Bio com <img src=x> imagem' };
            const result = await updateProfileSchema.parseAsync(data);
            // Bio usa sanitizeRichText que permite tags img, mas sanitiza atributos
            expect(result.bio).toBe('Bio com <img src="x"> imagem');
        });

        it('deve sanitizar o conteúdo do chat no sendMessageSchema', async () => {
            const data = {
                receiverId: '123',
                content: 'Hey <iframe src="xxx"></iframe> check this',
                type: 'text'
            };
            const result = await sendMessageSchema.parseAsync(data);
            expect(result.content).toBe('Hey check this');
        });
    });
});
