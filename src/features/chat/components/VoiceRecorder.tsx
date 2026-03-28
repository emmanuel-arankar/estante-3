import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { SendHorizontal, Trash2, Lock, Play, Pause, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecordingWaveform } from './RecordingWaveform';
import { cn } from '@/lib/utils';

export interface VoiceRecorderHandle {
    stopAndSend: () => void;
}

interface VoiceRecorderProps {
    stream: MediaStream | null;
    isLocked: boolean;
    onCancel: () => void;
    onSend: (blob: Blob, duration: number, waveform: number[], viewOnce: boolean) => void;
}

export const VoiceRecorder = forwardRef<VoiceRecorderHandle, VoiceRecorderProps>(
    ({ stream, isLocked: initialLocked, onCancel, onSend }, ref) => {
        const [isPaused, setIsPaused] = useState(false);
        const [duration, setDuration] = useState(0);
        const [isLocked, setIsLocked] = useState(initialLocked);
        const [viewOnce, setViewOnce] = useState(false);
        const mediaRecorderRef = useRef<MediaRecorder | null>(null);
        const chunksRef = useRef<Blob[]>([]);
        const levelsRef = useRef<number[]>([]);
        const timerRef = useRef<NodeJS.Timeout | null>(null);

        useEffect(() => {
            setIsLocked(initialLocked);
        }, [initialLocked]);

        useEffect(() => {
            if (!stream) return;

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

                // Validate minimum duration (1 second) and non-empty blob
                if (chunksRef.current.length > 0 && duration >= 1 && blob.size > 0) {
                    onSend(blob, duration, [...levelsRef.current], viewOnce);
                } else if (duration < 1) {
                    console.warn('Recording too short (< 1s), discarding');
                } else if (blob.size === 0) {
                    console.warn('Empty audio blob, discarding');
                }
            };

            mediaRecorder.start();

            timerRef.current = setInterval(() => {
                if (!isPaused) {
                    setDuration((d) => d + 1);
                }
            }, 1000);

            return () => {
                if (timerRef.current) clearInterval(timerRef.current);
                if (mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
            };
        }, [stream, isPaused, duration, viewOnce, onSend]);

        useImperativeHandle(ref, () => ({
            stopAndSend: () => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                }
            }
        }));

        const formatTime = (seconds: number) => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const handleCancel = () => {
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.onstop = null; // Prevent sending
                mediaRecorderRef.current.stop();
            }
            onCancel();
        };

        const handlePauseResume = () => {
            if (!mediaRecorderRef.current || !isLocked) return;

            if (isPaused) {
                // Resume
                if (mediaRecorderRef.current.state === 'paused') {
                    mediaRecorderRef.current.resume();
                }
                setIsPaused(false);
            } else {
                // Pause
                if (mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.pause();
                }
                setIsPaused(true);
            }
        };

        return (
            <div className="flex items-center space-x-3 w-full bg-gray-50 border border-gray-200 rounded-3xl px-3 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCancel}
                    className="h-10 w-10 rounded-full text-red-500 hover:bg-red-50"
                >
                    <Trash2 className="h-5 w-5" />
                </Button>

                <div className="flex-1 flex items-center space-x-3 px-2">
                    <div className="flex items-center space-x-2">
                        <div className={cn(
                            "h-2 w-2 rounded-full",
                            isPaused ? "bg-orange-500" : "bg-red-500 animate-pulse"
                        )} />
                        <span className="text-sm font-medium tabular-nums min-w-[40px]">
                            {formatTime(duration)}
                        </span>
                    </div>

                    {/* Waveform without dark container - clean overlay */}
                    <div className="flex-1 h-8 relative">
                        <RecordingWaveform stream={stream} isPaused={isPaused} dataRef={levelsRef} />
                    </div>
                </div>

                {/* Pause/Resume Button (only when locked) */}
                {isLocked && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePauseResume}
                        className="h-10 w-10 rounded-full hover:bg-gray-200"
                        title={isPaused ? "Retomar" : "Pausar"}
                    >
                        {isPaused ? (
                            <Play className="h-5 w-5 text-emerald-600" />
                        ) : (
                            <Pause className="h-5 w-5 text-gray-600" />
                        )}
                    </Button>
                )}

                {/* View Once Toggle (only when locked) */}
                {isLocked && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewOnce(!viewOnce)}
                        className={cn(
                            "h-10 w-10 rounded-full",
                            viewOnce ? "bg-purple-100 text-purple-600" : "hover:bg-gray-200 text-gray-600"
                        )}
                        title="Envio Único"
                    >
                        <Eye className="h-5 w-5" />
                    </Button>
                )}

                {isLocked ? (
                    <Button
                        onClick={() => mediaRecorderRef.current?.stop()}
                        className="h-10 w-10 rounded-full bg-emerald-600 hover:bg-emerald-700 p-0 shadow-md"
                    >
                        <SendHorizontal className="h-5 w-5 text-white" />
                    </Button>
                ) : (
                    <div className="flex flex-col items-center justify-center h-10 w-10 text-emerald-600">
                        <Lock className="h-4 w-4 animate-bounce" />
                    </div>
                )}
            </div>
        );
    }
);

VoiceRecorder.displayName = 'VoiceRecorder';
