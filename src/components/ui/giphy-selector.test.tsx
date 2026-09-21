import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { GiphySelector } from './giphy-selector';

describe('GiphySelector', () => {
    const mockOnSelect = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue({
            json: async () => ({
                data: [
                    {
                        id: 'gif1',
                        title: 'Test GIF 1',
                        images: {
                            fixed_width: { url: 'https://media.giphy.com/gif1_small.gif' },
                            original: { url: 'https://media.giphy.com/gif1_orig.gif' },
                        },
                    },
                ],
            }),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders search input', () => {
        renderWithProviders(<GiphySelector onSelect={mockOnSelect} />);

        const input = screen.getByPlaceholderText(/pesquisar gifs/i);
        expect(input).toBeInTheDocument();
    });

    it('makes only a single fetch call on mount (trending GIFs)', async () => {
        renderWithProviders(<GiphySelector onSelect={mockOnSelect} />);

        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });

        // Wait past debounced timeout (500ms) to ensure no secondary fetch is triggered
        await new Promise((resolve) => setTimeout(resolve, 600));

        // Should still be called only once on initial mount
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('fetches GIFs and calls onSelect when clicked', async () => {
        const user = userEvent.setup();
        renderWithProviders(<GiphySelector onSelect={mockOnSelect} />);

        const img = await screen.findByAltText('Test GIF 1');
        expect(img).toBeInTheDocument();

        await user.click(img);
        expect(mockOnSelect).toHaveBeenCalledWith('https://media.giphy.com/gif1_orig.gif');
    });
});
