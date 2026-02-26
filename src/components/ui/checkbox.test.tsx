import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './checkbox';

// Mock Radix UI Checkbox
vi.mock('@radix-ui/react-checkbox', () => ({
    Root: ({ children, checked, onCheckedChange, ...props }: any) => (
        <button
            role="checkbox"
            aria-checked={checked}
            onClick={() => onCheckedChange?.(!checked)}
            {...props}
        >
            {children}
        </button>
    ),
    Indicator: ({ children }: any) => <span>{children}</span>,
}));

describe('Checkbox', () => {
    it('renders checkbox', () => {
        renderWithProviders(<Checkbox />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
    });

    it('toggles checked state', async () => {
        const user = userEvent.setup();
        const handleChange = vi.fn();

        renderWithProviders(<Checkbox checked={false} onCheckedChange={handleChange} />);

        const checkbox = screen.getByRole('checkbox');
        await user.click(checkbox);

        expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('is disabled when disabled prop is true', () => {
        renderWithProviders(<Checkbox disabled />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeDisabled();
    });
});
