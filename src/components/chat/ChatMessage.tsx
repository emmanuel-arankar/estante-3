import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
    Check,
    CheckCheck,
    MoreVertical,
    Reply,
    Copy,
    Trash2,
    Play,
    Pause,
    Mic,
    Smile,
    Eye,
    Pencil,
    X
} from 'lucide-react';
import {
    Avatar,
    AvatarFallback,
    AvatarImage
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MediaViewer } from './MediaViewer';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Popover as PopoverUI,
    PopoverContent as PopoverContentUI,
    PopoverTrigger as PopoverTriggerUI,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { ChatMessage as ChatMessageType } from '@estante/common-types';

interface ChatMessageProps {
    message: ChatMessageType;
    isOwn: boolean;
    onReply?: () => void;
    onDelete?: () => void;
    onReact?: (emoji: string) => void;
    onMarkTemporaryAsPlayed?: (messageId: string) => Promise<void>;
    onMarkAsViewed?: (messageId: string) => Promise<void>;
    currentUserId?: string;
    showAvatar?: boolean;
    senderName?: string;
    senderPhoto?: string;
    onPlayNext?: () => void;
    onEdit?: () => void;
    onJumpToMessage?: (messageId: string) => void;
    searchQuery?: string;
    isCurrentMatch?: boolean;
}

import { useAudioStore } from '@/hooks/useAudioStore';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { formatAudioTime } from '@/utils/audioUtils';

const AudioPlayer = ({
    src,
    isOwn,
    id,
    isTemporary,
    playedAt,
    status,
    onMarkAsPlayed,
    waveform,
    onPlayNext,
    messageDuration
}: {
    src: string;
    isOwn: boolean;
    id: string;
    isTemporary?: boolean;
    playedAt?: Date | null;
    status?: 'sending' | 'sent' | 'error';
    onMarkAsPlayed?: () => Promise<void>;
    waveform?: number[];
    onPlayNext?: () => void;
    messageDuration?: number;
}) => {
    // Use AudioPlayerContext for centralized state management
    const { playAudio, pauseAudio, isPlaying: isAudioPlaying, getAudioElement } = useAudioPlayerContext();
    const { playbackRate, setPlaybackRate } = useAudioStore();

    const [isExpired, setIsExpired] = useState(!isOwn && !!playedAt);
    const [progress, setProgress] = useState(0);
    // Use duration from Firebase instantly - NO "..." placeholder
    const [duration] = useState(messageDuration || 0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragProgress, setDragProgress] = useState(0);
    const [hasError, setHasError] = useState(false);

    const progressBarRef = useRef<HTMLDivElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const isPlaying = isAudioPlaying(id);
    const isSending = status === 'sending';

    // Update playback rate when it changes
    useEffect(() => {
        const audio = getAudioElement(id);
        if (audio && isPlaying) {
            audio.playbackRate = playbackRate;
        }
    }, [playbackRate, isPlaying, id, getAudioElement]);

    // Animation frame loop for smooth progress updates
    useEffect(() => {
        if (!isPlaying) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            return;
        }

        const animate = () => {
            const audio = getAudioElement(id);
            if (audio && audio.duration && !isDragging) {
                setCurrentTime(audio.currentTime);
                setProgress((audio.currentTime / audio.duration) * 100);
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isPlaying, isDragging, id, getAudioElement]);

    const toggleSpeed = (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
        setPlaybackRate(nextRate);
    };

    const handlePlayPause = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSending || isExpired || hasError) return;

        if (isPlaying) {
            pauseAudio();
        } else {
            try {
                await playAudio(id, src, async () => {
                    // onEnded callback - sequential playback
                    setProgress(0);
                    setCurrentTime(0);

                    // Mark temporary audio as played
                    if (isTemporary && !isOwn && !isExpired) {
                        setIsExpired(true);
                        if (onMarkAsPlayed) {
                            try {
                                await onMarkAsPlayed();
                            } catch (err) {
                                console.error('Failed to mark as played:', err);
                            }
                        }
                    }

                    // Play next audio if available
                    if (onPlayNext) {
                        onPlayNext();
                    }
                });
            } catch (err) {
                console.error('Failed to play audio:', err);
                setHasError(true);
            }
        }
    };

    const getProgressFromEvent = (clientX: number): number => {
        if (!progressBarRef.current) return 0;
        const rect = progressBarRef.current.getBoundingClientRect();
        return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    };

    const handleSeekStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (isTemporary || isSending || isExpired || hasError) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        setIsDragging(true);
        setDragProgress(getProgressFromEvent(clientX));
    };

    const handleSeekMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        setDragProgress(getProgressFromEvent(clientX));
    };

    const handleSeekEnd = () => {
        if (!isDragging) return;
        const audio = getAudioElement(id);
        if (!audio || !duration) return;

        audio.currentTime = (dragProgress / 100) * duration;
        setProgress(dragProgress);
        setCurrentTime((dragProgress / 100) * duration);
        setIsDragging(false);
    };

    useEffect(() => {
        if (!isDragging) return;
        const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            setDragProgress(getProgressFromEvent(clientX));
        };
        const handleGlobalEnd = () => handleSeekEnd();
        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('mouseup', handleGlobalEnd);
        window.addEventListener('touchmove', handleGlobalMove);
        window.addEventListener('touchend', handleGlobalEnd);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalEnd);
            window.removeEventListener('touchmove', handleGlobalMove);
            window.removeEventListener('touchend', handleGlobalEnd);
        };
    }, [isDragging, dragProgress, duration]);

    const displayProgress = isDragging ? dragProgress : progress;

    return (
        <div className={cn(
            "flex flex-col space-y-1 py-1.5 min-w-[170px] transition-opacity",
            isSending && "opacity-60 grayscale-[0.5]",
            hasError && "opacity-50"
        )}>
            <div className="flex items-center space-x-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePlayPause}
                    disabled={isSending || isExpired || hasError}
                    className={cn(
                        "h-10 w-10 rounded-full flex-shrink-0 transition-all active:scale-90",
                        isOwn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-emerald-100 hover:bg-emerald-200 text-emerald-600",
                        (isExpired || hasError) && "opacity-50 cursor-not-allowed"
                    )}
                    title={hasError ? "Erro ao carregar áudio" : undefined}
                >
                    {isSending ? (
                        <div className="flex items-center justify-center">
                            <Mic className="h-5 w-5 animate-pulse text-red-500" />
                        </div>
                    ) : hasError ? (
                        <X className="h-5 w-5" />
                    ) : isExpired ? (
                        <Eye className="h-5 w-5 line-through" />
                    ) : isPlaying ? (
                        <Pause className="h-5 w-5 fill-current" />
                    ) : (
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                    )}
                </Button>

                <div className="flex-1 flex flex-col space-y-1.5">
                    <div
                        ref={progressBarRef}
                        onMouseDown={handleSeekStart}
                        onTouchStart={handleSeekStart}
                        onMouseMove={handleSeekMove}
                        onTouchMove={handleSeekMove}
                        className={cn(
                            "h-8 flex items-center space-x-0.5 relative group select-none",
                            isTemporary || isSending || isExpired || hasError ? "cursor-not-allowed" : "cursor-pointer"
                        )}
                    >
                        {(() => {
                            const bars = waveform && waveform.length > 0 ? waveform : Array.from({ length: 30 });
                            const MAX_BARS = 35;
                            const step = Math.ceil(bars.length / MAX_BARS);
                            const displayBars = bars.filter((_, i) => i % step === 0).slice(0, MAX_BARS);

                            return displayBars.map((value, i, arr) => {
                                const barProgress = (i / arr.length) * 100;
                                const isActive = barProgress <= displayProgress;

                                let baseHeight: number;
                                if (waveform && waveform.length > 0) {
                                    const val = typeof value === 'number' ? value : 0;
                                    baseHeight = 6 + (val * 18);
                                } else {
                                    baseHeight = 10 + (Math.sin(i * 0.8 + id.charCodeAt(0)) * 6) + (Math.cos(i * 0.4) * 4);
                                }

                                const tick = performance.now() / 150;
                                const pulseAmount = isPlaying && isActive ? Math.sin(tick + i * 0.5) * 4 + 2 : 0;
                                const height = baseHeight + pulseAmount;

                                return (
                                    <motion.div
                                        key={i}
                                        initial={false}
                                        animate={{
                                            height: Math.max(4, height),
                                            opacity: isActive ? 1 : 0.35,
                                            scale: isDragging && Math.abs(barProgress - displayProgress) < 4 ? 1.2 : 1
                                        }}
                                        transition={{ duration: 0.1 }}
                                        className={cn(
                                            "w-1 rounded-full transition-colors shrink-0",
                                            isOwn
                                                ? isActive ? "bg-white" : "bg-white/40"
                                                : isActive ? "bg-emerald-500" : "bg-emerald-200"
                                        )}
                                    />
                                );
                            });
                        })()}

                        <div
                            className={cn(
                                "absolute top-0 bottom-0 w-0.5 rounded-full transition-opacity",
                                isOwn ? "bg-white" : "bg-emerald-600",
                                isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                            )}
                            style={{ left: `${displayProgress}%` }}
                        />
                    </div>

                    <div className={cn(
                        "flex justify-between text-[10px] font-medium px-1",
                        isOwn ? "text-white/70" : "text-gray-400"
                    )}>
                        <span>{formatAudioTime(isDragging ? (dragProgress / 100) * duration : currentTime)}</span>
                        <span>{formatAudioTime(duration)}</span>
                    </div>
                </div>

                {!isSending && !isExpired && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSpeed}
                        className={cn(
                            "h-6 min-w-[32px] px-1 ml-0.5 rounded-full text-[10px] font-bold shrink-0 transition-colors",
                            isOwn
                                ? "text-white/70 hover:bg-white/20 hover:text-white"
                                : "text-emerald-600/70 hover:bg-emerald-100 hover:text-emerald-700"
                        )}
                    >
                        {playbackRate}x
                    </Button>
                )}
                {(isSending || isExpired) && (
                    <Mic className={cn("h-4 w-4 shrink-0 mt-2", isOwn ? "text-white/50" : "text-gray-300")} />
                )}
            </div>
        </div>
    );
};

import { requestTranscription } from '@/services/functions';
import { Loader2, FileText } from 'lucide-react';

const TranscriptionControl = ({ message, isOwn, currentUserId }: { message: ChatMessageType; isOwn: boolean; currentUserId?: string }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTranscribe = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            if (!currentUserId) throw new Error("Usuário não identificado");

            const participants = [message.senderId, message.receiverId].sort();
            const chatId = participants.join('_');

            await requestTranscription(chatId, message.id);
        } catch (err) {
            console.error(err);
            setError("Erro ao transcrever.");
        } finally {
            setIsLoading(false);
        }
    };

    if (error) {
        return (
            <div className="mt-1 px-1">
                <p className="text-[10px] text-red-500 flex items-center gap-1 cursor-pointer hover:underline" onClick={handleTranscribe}>
                    Erro. Tentar novamente?
                </p>
            </div>
        );
    }

    return (
        <div className="mt-1 px-1">
            <button
                onClick={handleTranscribe}
                disabled={isLoading}
                className={cn(
                    "flex items-center space-x-1.5 text-[10px] font-medium transition-colors hover:underline",
                    isOwn ? "text-white/70 hover:text-white" : "text-emerald-600/70 hover:text-emerald-700",
                    isLoading && "cursor-wait opacity-70"
                )}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Transcrevendo...</span>
                    </>
                ) : (
                    <>
                        <FileText className="h-3 w-3" />
                        <span>Transcrever áudio</span>
                    </>
                )}
            </button>
        </div>
    );
};

const MessageHighlighter = ({ text, query, isCurrent }: { text: string; query: string; isCurrent?: boolean }) => {
    if (!query.trim()) return <>{text}</>;

    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const normalizedText = normalize(text);
    const normalizedQuery = normalize(query);

    const parts = [];
    let lastIndex = 0;
    let index = normalizedText.indexOf(normalizedQuery);

    if (index === -1) return <>{text}</>;

    while (index !== -1) {
        parts.push(text.substring(lastIndex, index));
        const match = text.substring(index, index + query.length);
        parts.push(
            <mark
                key={index}
                className={cn(
                    "px-0.5 rounded-sm transition-colors duration-300",
                    isCurrent ? "bg-orange-400 text-white" : "bg-yellow-200 text-gray-900"
                )}
            >
                {match}
            </mark>
        );
        lastIndex = index + query.length;
        index = normalizedText.indexOf(normalizedQuery, lastIndex);
    }
    parts.push(text.substring(lastIndex));

    return <>{parts}</>;
};

export const ChatBubble = ({
    message,
    isOwn,
    onReply,
    onDelete,
    onReact,
    onMarkTemporaryAsPlayed,
    onMarkAsViewed,
    currentUserId,
    showAvatar,
    senderName,
    senderPhoto,
    onPlayNext,
    onEdit,
    onJumpToMessage,
    searchQuery = '',
    isCurrentMatch = false
}: ChatMessageProps) => {
    const [showActions, setShowActions] = useState(false);
    const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
    const [initialMediaIndex, setInitialMediaIndex] = useState(0);

    const handleImageClick = (index: number) => {
        setInitialMediaIndex(index);
        setMediaViewerOpen(true);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
    };

    const isImageOnly = message.type === 'image' && !message.caption && !message.replyTo && !message.isDeleted;

    const StatusTime = ({ light = false }: { light?: boolean }) => (
        <div className={cn(
            "flex items-center space-x-1 justify-end shrink-0",
            light ? "text-white text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] bg-black/20 px-1.5 py-0.5 rounded-full backdrop-blur-sm" :
                isOwn ? "text-white/60" : "text-gray-400",
            !light && "mt-1"
        )}>
            {message.editedAt && (
                <span className="text-[9px] mr-1">
                    (editada)
                </span>
            )}
            <span className="text-[10px]">
                {format(message.createdAt, 'HH:mm')}
            </span>
            {isOwn && (
                <div className="flex -space-x-1">
                    {message.status === 'sending' ? (
                        <div className="w-3 h-3 border border-white/40 border-t-transparent rounded-full animate-spin" />
                    ) : message.readAt ? (
                        <CheckCheck className={cn("h-3.3 w-3.3", (light || !isImageOnly) ? "text-blue-400" : "text-white")} />
                    ) : (
                        <Check className="h-3.3 w-3.3" />
                    )}
                </div>
            )}
        </div>
    );

    const handleReply = () => {
        onReply?.();
    };

    const handleDelete = () => {
        onDelete?.();
    };

    return (
        <motion.div
            className={cn(
                "flex items-end space-x-2 group",
                isOwn ? "justify-end" : "justify-start",
                "mb-1" // Reduz espaço entre mensagens
            )}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
            whileHover={!message.isDeleted ? { scale: 1.01 } : {}}
        >
            {!isOwn && showAvatar && (
                <Avatar className="h-8 w-8 mb-1 shrink-0">
                    <AvatarImage
                        src={senderPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${message.senderId}`}
                        alt={senderName || "Avatar"}
                    />
                    <AvatarFallback className="text-xs">
                        {(senderName || message.senderId).charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
            )}

            {!isOwn && !showAvatar && <div className="w-8" />}

            {isOwn && (
                <div className={cn(
                    "flex items-center space-x-1 opacity-0 transition-opacity",
                    showActions && !message.isDeleted && "opacity-100",
                    message.isDeleted && "pointer-events-none"
                )}>
                    <PopoverUI>
                        <PopoverTriggerUI asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Smile className="h-3 w-3" />
                            </Button>
                        </PopoverTriggerUI>
                        <PopoverContentUI side="top" align="center" className="w-auto p-1 rounded-full shadow-lg border-gray-100">
                            <div className="flex items-center space-x-1">
                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => onReact?.(emoji)}
                                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-lg"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </PopoverContentUI>
                    </PopoverUI>

                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReply}>
                        <Reply className="h-3 w-3" />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreVertical className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {isOwn && message.type === 'text' && !message.isDeleted && (
                                <DropdownMenuItem onClick={onEdit}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                </DropdownMenuItem>
                            )}
                            {message.type === 'text' && !message.isDeleted && (
                                <DropdownMenuItem onClick={handleCopy}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copiar
                                </DropdownMenuItem>
                            )}
                            {!message.isDeleted && (
                                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Deletar
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            <div className={cn(
                "flex flex-col min-w-0",
                isOwn ? "items-end" : "items-start",
                message.type === 'image' ? "max-w-[320px]" : "max-w-[85%] sm:max-w-[70%]" // Reduzido de 400px para 320px
            )}>
                {/* Nome do usuário - agora fica fora da bolha para não amassar */}
                {!isOwn && senderName && showAvatar && (
                    <div className="text-[11px] font-medium text-emerald-600 mb-0.5 leading-none px-1">
                        {senderName}
                    </div>
                )}

                <div
                    className={cn(
                        "rounded-2xl shadow-sm relative overflow-hidden",
                        isImageOnly ? "w-fit p-0 max-w-[320px]" : "w-full px-3 py-1.5",
                        message.type === 'image' && !isImageOnly && !message.isDeleted ? "max-w-[320px] p-1" : "", // Reduz padding
                        isOwn
                            ? "bg-emerald-600 text-white rounded-br-md"
                            : "bg-white text-gray-900 border border-gray-200 rounded-bl-md",
                        message.isDeleted && "italic opacity-80"
                    )}
                >
                    {message.replyTo && !message.isDeleted && (
                        <div
                            onClick={() => onJumpToMessage?.(message.replyTo!.id)}
                            className={cn(
                                "mb-2 p-2 rounded-lg border-l-4 text-xs min-w-[120px] max-w-full truncate cursor-pointer hover:bg-black/5 transition-colors",
                                isOwn ? "bg-white/10 border-white/40" : "bg-gray-100 border-emerald-500"
                            )}
                        >
                            <p className={cn("font-bold mb-0.5", isOwn ? "text-white/80" : "text-emerald-600")}>
                                {message.replyTo.senderId === currentUserId ? "Você" : (message.replyTo.senderName || "Usuário")}
                            </p>
                            <p className={cn("truncate", isOwn ? "text-white/60" : "text-gray-500")}>
                                {message.replyTo.type === 'image' ? '📷 Foto' :
                                    message.replyTo.type === 'audio' ? '🎤 Áudio' :
                                        message.replyTo.content}
                            </p>
                        </div>
                    )}

                    {message.isDeleted ? (
                        <p className="text-sm italic opacity-70">
                            {isOwn ? "Você apagou esta mensagem" : "Esta mensagem foi apagada"}
                        </p>
                    ) : message.type === 'text' ? (
                        <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed">
                            <MessageHighlighter
                                text={message.content}
                                query={searchQuery}
                                isCurrent={isCurrentMatch}
                            />
                        </p>
                    ) : message.type === 'audio' ? (
                        <>
                            <AudioPlayer
                                src={message.content}
                                isOwn={isOwn}
                                id={message.id}
                                isTemporary={message.isTemporary}
                                playedAt={message.playedAt}
                                status={message.status}
                                waveform={message.waveform}
                                messageDuration={message.duration}
                                onMarkAsPlayed={() => onMarkTemporaryAsPlayed?.(message.id) || Promise.resolve()}
                                onPlayNext={onPlayNext}
                            />
                            {(message.transcriptions?.[currentUserId || ''] || message.transcription) ? (
                                <div className={cn(
                                    "border-t mt-2 pt-1.5 px-0.5",
                                    isOwn ? "border-white/20" : "border-emerald-200"
                                )}>
                                    <p className={cn(
                                        "text-[11px] leading-snug italic",
                                        isOwn ? "text-white/80" : "text-emerald-700/80"
                                    )}>
                                        "{message.transcriptions?.[currentUserId || ''] || message.transcription}"
                                    </p>
                                </div>
                            ) : (
                                <TranscriptionControl
                                    message={message}
                                    isOwn={isOwn}
                                    currentUserId={currentUserId}
                                />
                            )}
                        </>
                    ) : message.type === 'image' ? (
                        <div className="flex flex-col space-y-2">
                            {message.viewOnce ? (
                                <div
                                    onClick={() => {
                                        if (!isOwn && !message.isViewed) {
                                            onMarkAsViewed?.(message.id);
                                        }
                                    }}
                                    className={cn(
                                        "flex items-center space-x-2 py-2 px-3 rounded-lg border transition-all cursor-pointer",
                                        message.isViewed
                                            ? "bg-gray-100/50 border-gray-200 text-gray-400"
                                            : isOwn ? "bg-white/20 border-white/30 text-white" : "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                    )}
                                >
                                    <div className={cn(
                                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                                        message.isViewed
                                            ? "bg-gray-200 text-gray-500"
                                            : "bg-emerald-500 text-white"
                                    )}>
                                        <div className="relative flex items-center justify-center">
                                            <Eye className="h-4 w-4" />
                                            {!message.isViewed && (
                                                <span className="absolute text-[8px] font-bold mt-[0.5px]">1</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">
                                            {message.isViewed ? 'Foto visualizada' : 'Foto de visualização única'}
                                        </p>
                                        {!message.isViewed && (
                                            <p className="text-[10px] opacity-70">Clique para visualizar</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                // WhatsApp-style Grid Container - MELHORADO
                                message.images && message.images.length > 0 ? (
                                    <>
                                        <div className={cn(
                                            "overflow-hidden relative group/img-container",
                                            isImageOnly ? "rounded-[18px]" : "rounded-xl",
                                            "bg-transparent",
                                            // Grid layouts específicos para cada quantidade
                                            message.images.length === 1 ? "" : "grid gap-[1px]",
                                            message.images.length === 2 ? "grid-cols-2 max-w-[320px]" : "",
                                            message.images.length === 3 ? "grid-cols-3 max-w-[320px]" : "", // 3 em linha reta
                                            message.images.length === 4 ? "grid-cols-2 grid-rows-2 max-w-[320px]" : "",
                                            message.images.length >= 5 ? "grid-cols-3 grid-rows-2 max-w-[320px]" : ""
                                        )}>
                                            {message.images.slice(0, message.images.length >= 5 ? 6 : message.images.length).map((img, idx) => {
                                                const total = message.images!.length;

                                                let itemClass = "relative cursor-pointer overflow-hidden bg-gray-100";
                                                let imgClass = "w-full h-full object-cover transition-all duration-200 hover:brightness-95";

                                                // Layouts específicos
                                                if (total === 1) {
                                                    itemClass = "relative cursor-pointer w-full flex bg-transparent";
                                                    imgClass = "max-h-[280px] max-w-[320px] w-auto h-auto object-contain rounded-xl block";
                                                } else if (total === 2) {
                                                    itemClass += " aspect-square";
                                                } else if (total === 3) {
                                                    // 3 imagens em linha reta - todas iguais
                                                    itemClass += " aspect-square";
                                                } else if (total === 4) {
                                                    itemClass += " aspect-square";
                                                } else if (total >= 5) {
                                                    // Para 5+ imagens, grid 3x2
                                                    itemClass += " aspect-square";
                                                }

                                                // Bordas arredondadas específicas para grid
                                                if (total > 1) {
                                                    if (idx === 0) {
                                                        itemClass += " rounded-tl-xl";
                                                        if (total === 2) itemClass += " rounded-bl-xl";
                                                    }
                                                    if (total === 2 && idx === 1) {
                                                        itemClass += " rounded-tr-xl rounded-br-xl";
                                                    }
                                                    if (total === 3) {
                                                        if (idx === 0) itemClass += " rounded-l-xl";
                                                        if (idx === 2) itemClass += " rounded-r-xl";
                                                    }
                                                    if (total === 4) {
                                                        if (idx === 0) itemClass += " rounded-tl-xl";
                                                        if (idx === 1) itemClass += " rounded-tr-xl";
                                                        if (idx === 2) itemClass += " rounded-bl-xl";
                                                        if (idx === 3) itemClass += " rounded-br-xl";
                                                    }
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={itemClass}
                                                        onClick={() => handleImageClick(idx)}
                                                    >
                                                        <img
                                                            src={img}
                                                            className={imgClass}
                                                            loading="lazy"
                                                        />
                                                        {/* Overlay for +N - apenas na última célula quando houver mais */}
                                                        {((total >= 5 && idx === 5) || (total === 6 && idx === 5)) && total > 6 && (
                                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl">
                                                                +{total - 6}
                                                            </div>
                                                        )}
                                                        {total === 5 && idx === 4 && total > 5 && (
                                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl">
                                                                +{total - 5}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* Timestamp Overlay para TODAS as imagens */}
                                            <div className="absolute bottom-2 right-2 z-10">
                                                <StatusTime light />
                                            </div>

                                        </div>

                                        {message.images && (
                                            <MediaViewer
                                                isOpen={mediaViewerOpen}
                                                onClose={() => setMediaViewerOpen(false)}
                                                images={message.images}
                                                initialIndex={initialMediaIndex}
                                                senderName={senderName}
                                                senderPhoto={senderPhoto}
                                                timestamp={message.createdAt}
                                                caption={message.caption}
                                                messageId={message.id}
                                            />
                                        )}
                                    </>
                                ) : (
                                    // Single Image Fallback
                                    <div className="relative group/img overflow-hidden rounded-xl max-w-[320px]">
                                        <img
                                            src={message.content}
                                            alt="Shared"
                                            className="max-h-[280px] max-w-[320px] w-auto h-auto object-contain cursor-pointer rounded-xl"
                                            onClick={() => handleImageClick(0)}
                                            loading="lazy"
                                        />

                                        {/* Timestamp Overlay */}
                                        <div className="absolute bottom-2 right-2 z-10">
                                            <StatusTime light />
                                        </div>


                                        <MediaViewer
                                            isOpen={mediaViewerOpen}
                                            onClose={() => setMediaViewerOpen(false)}
                                            images={[message.content]}
                                            initialIndex={0}
                                            senderName={senderName}
                                            senderPhoto={senderPhoto}
                                            timestamp={message.createdAt}
                                            caption={message.caption}
                                        />
                                    </div>
                                )
                            )}
                            {message.caption && (
                                <p className={cn(
                                    "text-sm px-1 pb-1 leading-relaxed break-words whitespace-pre-wrap mt-1",
                                    message.viewOnce && "opacity-80"
                                )}>
                                    <MessageHighlighter
                                        text={message.caption}
                                        query={searchQuery}
                                        isCurrent={isCurrentMatch}
                                    />
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <div className="bg-emerald-100 p-2 rounded-lg">
                                <Mic className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">Livro Compartilhado</p>
                                <p className="text-xs text-gray-500 truncate">{message.content}</p>
                            </div>
                        </div>
                    )}

                    {/* Reactions Display */}
                    {message.reactions && Object.keys(message.reactions).length > 0 && !message.isDeleted && (
                        <div className={cn(
                            "flex flex-wrap gap-1",
                            isImageOnly ? "mt-1 mb-0 z-20 relative px-2" : "mt-1.5", // Ajustado
                            isOwn ? "justify-end" : "justify-start"
                        )}>
                            {Object.entries(message.reactions).map(([emoji, users]) => (
                                <button
                                    key={emoji}
                                    onClick={() => onReact?.(emoji)}
                                    className={cn(
                                        "px-1.5 py-0.5 rounded-full text-[10px] flex items-center space-x-1 transition-all",
                                        users.includes(currentUserId || '')
                                            ? isOwn ? "bg-white/30 text-white" : "bg-emerald-100 text-emerald-700 border-emerald-200 border"
                                            : isOwn ? "bg-white/10 text-white/70" : "bg-gray-50 text-gray-600 border-gray-200 border"
                                    )}
                                >
                                    <span>{emoji}</span>
                                    <span>{users.length}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Status & Time - mostrado abaixo do conteúdo se não for uma imagem sozinha */}
                    {!isImageOnly && (
                        <StatusTime />
                    )}
                </div>
            </div>

            {!isOwn && !message.isDeleted && (
                <div className={cn(
                    "flex items-center space-x-1 opacity-0 transition-opacity",
                    showActions && !message.isDeleted && "opacity-100",
                    message.isDeleted && "pointer-events-none"
                )}>
                    <PopoverUI>
                        <PopoverTriggerUI asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Smile className="h-3 w-3" />
                            </Button>
                        </PopoverTriggerUI>
                        <PopoverContentUI side="top" align="center" className="w-auto p-1 rounded-full shadow-lg border-gray-100">
                            <div className="flex items-center space-x-1">
                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => onReact?.(emoji)}
                                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-lg"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </PopoverContentUI>
                    </PopoverUI>

                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReply}>
                        <Reply className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </motion.div>
    );
};