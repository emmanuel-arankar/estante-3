import { Mark, mergeAttributes } from '@tiptap/core';

export interface SpoilerOptions {
    HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        spoiler: {
            setSpoiler: () => ReturnType;
            toggleSpoiler: () => ReturnType;
            unsetSpoiler: () => ReturnType;
        };
    }
}

export const SpoilerMark = Mark.create<SpoilerOptions>({
    name: 'spoiler',

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    excludes: '', // Allow spoiler to be used with other marks (bold, italic, color)

    parseHTML() {
        return [
            {
                tag: 'span[data-spoiler]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-spoiler': 'true', class: 'spoiler-box' }), 0];
    },

    addCommands() {
        return {
            setSpoiler: () => ({ commands }) => {
                return commands.setMark(this.name);
            },
            toggleSpoiler: () => ({ commands }) => {
                return commands.toggleMark(this.name);
            },
            unsetSpoiler: () => ({ commands }) => {
                return commands.unsetMark(this.name);
            },
        };
    },
});
