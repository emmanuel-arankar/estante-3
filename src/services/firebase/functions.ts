import { apiClient } from '@/services/api/apiClient';

export const requestTranscription = async (chatId: string, messageId: string) => {
  try {
    const result = await apiClient<{ transcription: string }>('/chat/transcription', {
      method: 'POST',
      data: { chatId, messageId }
    });

    return result;
  } catch (error) {
    console.error('Error requesting transcription:', error);
    throw error;
  }
};
