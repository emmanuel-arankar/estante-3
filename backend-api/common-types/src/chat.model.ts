export interface ChatMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    type: 'text' | 'image' | 'audio' | 'book' | 'viewOnce';
    createdAt: any;
    isDeleted?: boolean;
    status?: 'sending' | 'sent' | 'error';
    replyTo?: {
        id: string;
        content: string;
        type: string;
        senderId: string;
        senderName: string;
    };
    reactions?: Record<string, string[]>;
    editedAt?: Date | string | number | null;
    readAt?: Date | string | number | null;
    images?: string[];
    caption?: string;
    viewOnce?: boolean;
    isViewed?: boolean;
    viewedAt?: Date | string | number | null;
    transcription?: string;
    transcriptions?: Record<string, string>;
    isTemporary?: boolean;
    playedAt?: Date | string | number | null;
    duration?: number;
    waveform?: number[];
    uploadProgress?: number;
}
