type FirebaseTimestamp = { seconds: number; nanoseconds: number };
type Timestamp = string | number | Date | FirebaseTimestamp;

export interface ChatMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    type: 'text' | 'image' | 'audio' | 'book' | 'viewOnce';
    createdAt: Timestamp;
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
    editedAt?: Timestamp;
    readAt?: Timestamp;
    images?: string[];
    caption?: string;
    viewOnce?: boolean;
    isViewed?: boolean;
    viewedAt?: Timestamp;
    transcription?: string;
    transcriptions?: Record<string, string>;
    isTemporary?: boolean;
    playedAt?: Timestamp;
    duration?: number;
    waveform?: number[];
    uploadProgress?: number;
}
