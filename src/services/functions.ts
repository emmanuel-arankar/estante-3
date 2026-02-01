import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

export const requestTranscription = async (chatId: string, messageId: string) => {
    try {
        const requestTranscriptionFn = httpsCallable(functions, 'requestTranscription');

        const result = await requestTranscriptionFn({ chatId, messageId });
        return result.data as { transcription: string };
    } catch (error) {
        console.error('Error requesting transcription:', error);
        throw error;
    }
};
