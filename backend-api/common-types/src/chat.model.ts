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
    editedAt?: any;
    readAt?: any;
    images?: string[];
    caption?: string;
    viewOnce?: boolean;
    isViewed?: boolean;
    viewedAt?: any;
    transcription?: string;
    transcriptions?: Record<string, string>;
    isTemporary?: boolean;
    playedAt?: any;
    duration?: number;
    waveform?: number[];
    uploadProgress?: number;
}
