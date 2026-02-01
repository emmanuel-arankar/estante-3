import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';
import { SpeechClient, protos } from '@google-cloud/speech';

// Inicializa o Firebase Admin apenas uma vez
if (getApps().length === 0) {
    initializeApp();
}

const speech = new SpeechClient();

export const requestTranscription = onCall(async (request) => {
    // 1. Verificação de Autenticação
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'O usuário precisa estar logado para solicitar transcrição.');
    }

    const { chatId, messageId } = request.data;
    if (!chatId || !messageId) {
        throw new HttpsError('invalid-argument', 'chatId e messageId são obrigatórios.');
    }

    const db = getDatabase();
    const userId = request.auth.uid;

    try {
        // 2. Busca a mensagem e verifica permissão
        const messageRef = db.ref(`chats/${chatId}/messages/${messageId}`);
        const messageSnap = await messageRef.once('value');

        if (!messageSnap.exists()) {
            throw new HttpsError('not-found', 'Mensagem não encontrada.');
        }

        const message = messageSnap.val();
        if (!message) {
            throw new HttpsError('not-found', 'Dados da mensagem vazios.');
        }

        // Verifica se o usuário é participante da conversa
        // O chatId é composto por uid1_uid2. Verifica se o userId está nele.
        if (!chatId.includes(userId)) {
            throw new HttpsError('permission-denied', 'Você não tem permissão para transcrever esta mensagem.');
        }

        // Dupla verificação com dados da mensagem
        if (message.senderId !== userId && message.receiverId !== userId) {
            throw new HttpsError('permission-denied', 'Você não tem permissão para transcrever esta mensagem (ID mismatch).');
        }

        if (message.type !== 'audio') {
            throw new HttpsError('invalid-argument', 'A mensagem não é um áudio.');
        }

        const userTranscription = message.transcriptions?.[userId];
        if (userTranscription) {
            return { transcription: userTranscription }; // Já transcrito para este usuário
        }

        // 3. Processa a transcrição
        const audioUrl = message.content as string;

        // URL típica: https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile?alt=media&token=xxx
        // Precisamos extrair o path decoded
        const urlPath = decodeURIComponent(audioUrl.replace(/.*\/o\//, '').split('?')[0]);

        const bucket = getStorage().bucket();
        const audioFile = bucket.file(urlPath);

        // Verifica se arquivo existe
        const [exists] = await audioFile.exists();
        if (!exists) {
            throw new HttpsError('not-found', 'Arquivo de áudio não encontrado no Storage. URL: ' + audioUrl);
        }

        const [audioBuffer] = await audioFile.download();

        const recognizeRequest: protos.google.cloud.speech.v1.IRecognizeRequest = {
            config: {
                encoding: 'WEBM_OPUS' as const,
                sampleRateHertz: 48000,
                languageCode: 'pt-BR',
                enableAutomaticPunctuation: true,
                model: 'latest_long',
                useEnhanced: true,
            },
            audio: {
                content: audioBuffer.toString('base64'),
            },
        };

        const [response] = await speech.recognize(recognizeRequest);

        const transcription = response.results
            ?.map(result => result.alternatives?.[0]?.transcript)
            .filter(Boolean)
            .join(' ') || '';

        if (!transcription) {
            return { transcription: '' }; // Áudio mudo ou ininteligível
        }

        // 4. Salva o resultado no Realtime Database
        // Salva de forma privada para o usuário que solicitou: transcriptions/{userId}
        // Assim, outro usuário não vê que você transcreveu.
        await messageRef.child('transcriptions').update({
            [userId]: transcription
        });

        return { transcription };

    } catch (error: any) {
        console.error('Erro na transcrição:', error);
        // Retorna erro amigável para o cliente
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Erro interno ao processar transcrição.', error.message);
    }
});
