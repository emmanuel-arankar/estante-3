import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { preloadAudio, cleanupAudioElement, revokeBlobUrl } from '@/utils/audioUtils';

interface AudioPlayerContextType {
    activeAudioId: string | null;
    playAudio: (audioId: string, src: string, onEnded?: () => void) => Promise<void>;
    pauseAudio: () => void;
    isPlaying: (audioId: string) => boolean;
    preloadNextAudio: (audioId: string, src: string) => void;
    cleanup: (audioId: string) => void;
    getAudioElement: (audioId: string) => HTMLAudioElement | null;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export const useAudioPlayerContext = () => {
    const context = useContext(AudioPlayerContext);
    if (!context) {
        throw new Error('useAudioPlayerContext must be used within AudioPlayerProvider');
    }
    return context;
};

interface AudioPlayerProviderProps {
    children: ReactNode;
}

export const AudioPlayerProvider = ({ children }: AudioPlayerProviderProps) => {
    const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
    const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
    const erroredAudiosRef = useRef<Set<string>>(new Set());
    const onEndedCallbacksRef = useRef<Map<string, () => void>>(new Map());

    const cleanup = useCallback((audioId: string) => {
        const audio = audioElementsRef.current.get(audioId);
        if (audio) {
            cleanupAudioElement(audio);
            audioElementsRef.current.delete(audioId);
        }
        onEndedCallbacksRef.current.delete(audioId);
    }, []);

    const pauseAudio = useCallback(() => {
        if (activeAudioId) {
            const audio = audioElementsRef.current.get(activeAudioId);
            if (audio) {
                audio.pause();
            }
            setActiveAudioId(null);
        }
    }, [activeAudioId]);

    const playAudio = useCallback(async (audioId: string, src: string, onEnded?: () => void) => {
        // Pause any currently playing audio
        if (activeAudioId && activeAudioId !== audioId) {
            pauseAudio();
        }

        // Check if this audio has errored before
        if (erroredAudiosRef.current.has(audioId)) {
            console.warn(`Audio ${audioId} previously failed, skipping`);
            if (onEnded) onEnded(); // Skip to next
            return;
        }

        try {
            let audio = audioElementsRef.current.get(audioId);

            // If audio element doesn't exist, create/preload it
            if (!audio) {
                audio = await preloadAudio(src);
                audioElementsRef.current.set(audioId, audio);

                // Setup ended handler
                audio.addEventListener('ended', () => {
                    setActiveAudioId(null);
                    const callback = onEndedCallbacksRef.current.get(audioId);
                    if (callback) {
                        callback();
                    }
                });
            }

            // Store onEnded callback
            if (onEnded) {
                onEndedCallbacksRef.current.set(audioId, onEnded);
            }

            setActiveAudioId(audioId);
            await audio.play();
        } catch (err) {
            console.error(`Failed to play audio ${audioId}:`, err);
            erroredAudiosRef.current.add(audioId);
            setActiveAudioId(null);

            // Call onEnded to skip to next audio if sequential playback
            if (onEnded) {
                onEnded();
            }
        }
    }, [activeAudioId, pauseAudio]);

    const preloadNextAudio = useCallback((audioId: string, src: string) => {
        // Don't preload if already loaded or errored
        if (audioElementsRef.current.has(audioId) || erroredAudiosRef.current.has(audioId)) {
            return;
        }

        preloadAudio(src)
            .then((audio) => {
                audioElementsRef.current.set(audioId, audio);
            })
            .catch((err) => {
                console.warn(`Failed to preload audio ${audioId}:`, err);
                erroredAudiosRef.current.add(audioId);
            });
    }, []);

    const isPlaying = useCallback((audioId: string) => {
        return activeAudioId === audioId;
    }, [activeAudioId]);

    const getAudioElement = useCallback((audioId: string) => {
        return audioElementsRef.current.get(audioId) || null;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            audioElementsRef.current.forEach((audio) => {
                cleanupAudioElement(audio);
                const src = audio.src;
                if (src) revokeBlobUrl(src);
            });
            audioElementsRef.current.clear();
            onEndedCallbacksRef.current.clear();
            erroredAudiosRef.current.clear();
        };
    }, []);

    const value: AudioPlayerContextType = {
        activeAudioId,
        playAudio,
        pauseAudio,
        isPlaying,
        preloadNextAudio,
        cleanup,
        getAudioElement,
    };

    return (
        <AudioPlayerContext.Provider value={value}>
            {children}
        </AudioPlayerContext.Provider>
    );
};
