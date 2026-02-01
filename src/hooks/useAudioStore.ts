import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AudioState {
    activeId: string | null;
    setActiveId: (id: string | null) => void;
    playbackRate: number;
    setPlaybackRate: (rate: number) => void;
}

export const useAudioStore = create<AudioState>()(
    persist(
        (set) => ({
            activeId: null,
            setActiveId: (id) => set({ activeId: id }),
            playbackRate: 1,
            setPlaybackRate: (rate) => set({ playbackRate: rate }),
        }),
        {
            name: 'audio-storage', // unique name
            partialize: (state) => ({ playbackRate: state.playbackRate }), // Only persist rate, not activeId
        }
    )
);
