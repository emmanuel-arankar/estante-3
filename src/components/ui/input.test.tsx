import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { Input } from './input';

describe('Input', () => {
    it('renders input element', () => {
        renderWithProviders(<Input placeholder="Test input" />);

        const input = screen.getByPlaceholderText(/test input/i);
        expect(input).toBeInTheDocument();
    });

    it('accepts text input', async () => {
        const user = userEvent.setup();
        renderWithProviders(<Input placeholder="Email" />);

        const input = screen.getByPlaceholderText(/email/i) as HTMLInputElement;

        await user.type(input, 'test@example.com');

        expect(input.value).toBe('test@example.com');
    });

    it('applies className correctly', () => {
        renderWithProviders(<Input className="custom-class" />);

        const input = screen.getByRole('textbox');
        expect(input.className).toContain('custom-class');
    });

    it('is disabled when disabled prop is true', () => {
        renderWithProviders(<Input disabled />);

        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
    });

    it('supports different input types', () => {
        const { rerender } = renderWithProviders(<Input type="email" data-testid="email-input" />);

        let input = screen.getByTestId('email-input') as HTMLInputElement;
        expect(input.type).toBe('email');

        rerender(<Input type="password" data-testid="email-input" />);
        input = screen.getByTestId('email-input') as HTMLInputElement;
        expect(input.type).toBe('password');
    });
});
