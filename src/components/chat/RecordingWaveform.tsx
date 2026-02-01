import { useEffect, useRef } from 'react';

interface RecordingWaveformProps {
    stream: MediaStream | null;
    isPaused: boolean;
    barColor?: string;
    barWidth?: number;
    gap?: number;
    dataRef?: React.MutableRefObject<number[]>; // New prop to expose data
}

export const RecordingWaveform = ({
    stream,
    isPaused,
    barColor = '#10b981', // emerald-500
    barWidth = 3,
    gap = 1,
    dataRef
}: RecordingWaveformProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const animationIdRef = useRef<number | null>(null);
    const localLevelsRef = useRef<number[]>([]);

    // Use external ref if provided, otherwise local
    const levelsRef = dataRef || localLevelsRef;

    // Fixed Step Loop Control
    const lastTimeRef = useRef<number>(0);
    const accumulatorRef = useRef<number>(0);
    const FIXED_STEP = 50; // 50ms = 20 bars per second (Fixed resolution)

    // Setup Audio Context & Analyser
    useEffect(() => {
        if (!stream) return;

        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);

            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.5; // Suavizar mudanças
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

            return () => {
                if (audioContext.state !== 'closed') {
                    audioContext.close();
                }
            };
        } catch (err) {
            console.error("Error initializing audio context for waveform:", err);
        }
    }, [stream]);

    // Animation & Sampling Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Handle high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const draw = (time: number) => {
            if (!canvas || !ctx) return;

            // Calculate delta time
            const deltaTime = time - lastTimeRef.current;
            lastTimeRef.current = time;

            // Cap delta time to prevent spiraling (max 100ms)
            accumulatorRef.current += Math.min(deltaTime, 100);

            // Sampling Logic: Fixed Step
            // Only add new bars if enough time has passed (and we are recording)
            while (accumulatorRef.current >= FIXED_STEP) {
                accumulatorRef.current -= FIXED_STEP;

                if (!isPaused && analyserRef.current && dataArrayRef.current) {
                    analyserRef.current.getByteFrequencyData(dataArrayRef.current);

                    // RMS-like calculation focusing on voice freqs
                    let sum = 0;
                    const length = dataArrayRef.current.length;
                    const start = Math.floor(length * 0.1);
                    const end = Math.floor(length * 0.7);
                    const count = end - start;

                    for (let i = start; i < end; i++) {
                        sum += dataArrayRef.current[i];
                    }

                    const average = sum / count;

                    // Normalize (0-255 -> 0-1)
                    let normalized = average / 50;

                    // Silence Threshold: Strictly ignore noise below user perception
                    if (normalized < 0.05) {
                        normalized = 0.05; // Minimum visual height
                    } else {
                        normalized = Math.min(1, Math.max(0.05, normalized));
                    }

                    levelsRef.current.push(normalized);
                }
                // If paused, we effectively "skip" pushing data, just holding state.
            }

            // Drawing Logic: Runs every frame (60fps) for smoothness
            // But data (bars) only updates at 20fps
            ctx.clearRect(0, 0, rect.width, rect.height);

            const totalBarWidth = barWidth + gap;
            const maxBars = Math.floor(rect.width / totalBarWidth);

            const visibleLevels = levelsRef.current.length > maxBars
                ? levelsRef.current.slice(-maxBars)
                : levelsRef.current;

            const startX = 0; // Always start drawing from left

            ctx.fillStyle = barColor;

            visibleLevels.forEach((level, index) => {
                const x = startX + (index * totalBarWidth);
                const barHeight = Math.max(2, level * rect.height * 0.8);
                const y = (rect.height - barHeight) / 2;

                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
                } else {
                    ctx.rect(x, y, barWidth, barHeight);
                }
                ctx.fill();
            });

            animationIdRef.current = requestAnimationFrame(draw);
        };

        // Initialize time
        lastTimeRef.current = performance.now();
        animationIdRef.current = requestAnimationFrame(draw);

        return () => {
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
        };
    }, [isPaused, barColor, barWidth, gap]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full"
        />
    );
};
