/**
 * Audio utilities for preloading, cleanup, and validation
 */

/**
 * Preload an audio element from a URL
 */
export const preloadAudio = (src: string): Promise<HTMLAudioElement> => {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.preload = 'auto';

        const handleCanPlay = () => {
            cleanup();
            resolve(audio);
        };

        const handleError = () => {
            cleanup();
            reject(new Error(`Failed to load audio: ${src}`));
        };

        const cleanup = () => {
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
        };

        audio.addEventListener('canplaythrough', handleCanPlay);
        audio.addEventListener('error', handleError);
        audio.src = src;
        audio.load();
    });
};

/**
 * Cleanup an audio element properly
 */
export const cleanupAudioElement = (audio: HTMLAudioElement) => {
    try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.load(); // Force release of resources
    } catch (err) {
        console.warn('Error cleaning up audio element:', err);
    }
};

/**
 * Revoke a Blob URL to free memory
 */
export const revokeBlobUrl = (url: string) => {
    try {
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    } catch (err) {
        console.warn('Error revoking blob URL:', err);
    }
};

/**
 * Check if audio duration is valid (minimum 1 second)
 */
export const isValidAudioDuration = (duration: number): boolean => {
    return duration >= 1 && isFinite(duration) && !isNaN(duration);
};

/**
 * Format time in MM:SS format
 */
export const formatAudioTime = (time: number): string => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};
