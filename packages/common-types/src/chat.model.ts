export interface ChatMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    type: 'text' | 'image' | 'audio' | 'book' | 'viewOnce';
    createdAt: Date | string | { toDate: () => Date };
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
    editedAt?: Date | string | { toDate: () => Date };
    readAt?: Date | string | { toDate: () => Date };
    images?: string[];
    caption?: string;
    viewOnce?: boolean;
    isViewed?: boolean;
    viewedAt?: Date | string | { toDate: () => Date };
    transcription?: string;
    transcriptions?: Record<string, string>;
    isTemporary?: boolean;
    playedAt?: Date | string | { toDate: () => Date };
    duration?: number;
    waveform?: number[];
    uploadProgress?: number;
}
