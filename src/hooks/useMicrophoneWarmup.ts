import { useRef, useState, useCallback, useEffect } from 'react';

interface MicrophoneState {
    stream: MediaStream | null;
    isWarmedUp: boolean;
    isWarmingUp: boolean;
    error: Error | null;
}

/**
 * Hook para pré-aquecer o microfone e evitar delay/cortes no início da gravação.
 * 
 * O problema: O hardware de áudio precisa de ~50-200ms para estabilizar após
 * getUserMedia(). Se gravarmos imediatamente, as primeiras palavras são cortadas.
 * 
 * A solução: Adquirir o stream ANTES do clique em gravar (ex: quando o chat abre).
 * O stream fica "quente" mas sem gravar nada. Quando o usuário clica, já está pronto.
 */
export const useMicrophoneWarmup = () => {
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const [state, setState] = useState<MicrophoneState>({
        stream: null,
        isWarmedUp: false,
        isWarmingUp: false,
        error: null,
    });

    /**
     * Inicia o warm-up do microfone.
     * Pode ser chamado em:
     * - componentDidMount do Chat
     * - onFocus do input de mensagem
     * - onMouseEnter no botão de microfone
     */
    const warmup = useCallback(async (): Promise<MediaStream | null> => {
        // Já aquecido? Retorna stream existente
        if (streamRef.current && state.isWarmedUp) {
            return streamRef.current;
        }

        // Já em processo de aquecimento? Aguarda
        if (state.isWarmingUp) {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (streamRef.current) {
                        clearInterval(checkInterval);
                        resolve(streamRef.current);
                    }
                }, 50);
                // Timeout de segurança
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(streamRef.current);
                }, 3000);
            });
        }

        setState(prev => ({ ...prev, isWarmingUp: true, error: null }));

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                }
            });

            streamRef.current = stream;

            // Cria AudioContext apenas para manter o stream ativo
            // Isso evita que alguns navegadores "durmam" o stream
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(stream);

            // Conecta a um gain node com volume 0 (silencioso mas ativo)
            const gainNode = audioContextRef.current.createGain();
            gainNode.gain.value = 0;
            source.connect(gainNode);
            // Não conectamos ao destination para não haver feedback

            // Aguarda estabilização do hardware (~150ms é seguro para maioria dos devices)
            await new Promise(resolve => setTimeout(resolve, 150));

            setState({
                stream,
                isWarmedUp: true,
                isWarmingUp: false,
                error: null,
            });

            return stream;
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Microphone access failed');
            setState({
                stream: null,
                isWarmedUp: false,
                isWarmingUp: false,
                error: err,
            });
            return null;
        }
    }, [state.isWarmedUp, state.isWarmingUp]);

    /**
     * Retorna o stream pré-aquecido (ou null se não estiver pronto).
     * Use isso no VoiceRecorder ao invés de chamar getUserMedia novamente.
     */
    const getStream = useCallback((): MediaStream | null => {
        return streamRef.current;
    }, []);

    /**
     * Libera o stream e fecha o AudioContext.
     * Chamar quando o chat for desmontado ou quando terminar de gravar.
     */
    const release = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }
        setState({
            stream: null,
            isWarmedUp: false,
            isWarmingUp: false,
            error: null,
        });
    }, []);

    /**
     * Clona o stream atual para uso no MediaRecorder.
     * Isso permite que o warm-up continue ativo enquanto gravamos.
     */
    const cloneStream = useCallback((): MediaStream | null => {
        if (!streamRef.current) return null;

        // Clona as tracks para o MediaRecorder usar
        const clonedTracks = streamRef.current.getAudioTracks().map(track => track.clone());
        return new MediaStream(clonedTracks);
    }, []);

    // Cleanup automático quando o componente desmonta
    useEffect(() => {
        return () => {
            release();
        };
    }, [release]);

    return {
        warmup,
        getStream,
        cloneStream,
        release,
        isWarmedUp: state.isWarmedUp,
        isWarmingUp: state.isWarmingUp,
        error: state.error,
    };
};

export type UseMicrophoneWarmupReturn = ReturnType<typeof useMicrophoneWarmup>;
