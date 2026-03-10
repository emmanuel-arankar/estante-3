export interface ChatMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    type: 'text' | 'image' | 'audio' | 'book' | 'viewOnce';
    createdAt: Date | { seconds: number; nanoseconds: number };
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
    editedAt?: Date | { seconds: number; nanoseconds: number };
    readAt?: Date | { seconds: number; nanoseconds: number };
    images?: string[];
    caption?: string;
    viewOnce?: boolean;
    isViewed?: boolean;
    viewedAt?: Date | { seconds: number; nanoseconds: number };
    transcription?: string;
    transcriptions?: Record<string, string>;
    isTemporary?: boolean;
    playedAt?: Date | { seconds: number; nanoseconds: number };
    duration?: number;
    waveform?: number[];
    uploadProgress?: number;
}
