export interface ChatMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    type: 'text' | 'image' | 'audio' | 'book' | 'viewOnce';
    createdAt: string | number | Date | { seconds: number; nanoseconds: number };
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
    editedAt?: string | number | Date | { seconds: number; nanoseconds: number };
    readAt?: string | number | Date | { seconds: number; nanoseconds: number };
    images?: string[];
    caption?: string;
    viewOnce?: boolean;
    isViewed?: boolean;
    viewedAt?: string | number | Date | { seconds: number; nanoseconds: number };
    transcription?: string;
    transcriptions?: Record<string, string>;
    isTemporary?: boolean;
    playedAt?: string | number | Date | { seconds: number; nanoseconds: number };
    duration?: number;
    waveform?: number[];
    uploadProgress?: number;
}
