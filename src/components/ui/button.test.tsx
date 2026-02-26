import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { Button } from './button';

describe('Button', () => {
    it('renders button with text', () => {
        renderWithProviders(<Button>Click me</Button>);

        const button = screen.getByRole('button', { name: /click me/i });
        expect(button).toBeInTheDocument();
    });

    it('renders as child when asChild is true', () => {
        renderWithProviders(
            <Button asChild>
                <a href="/test">Link Button</a>
            </Button>
        );

        const link = screen.getByRole('link', { name: /link button/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/test');
    });

    it('applies variant className correctly', () => {
        renderWithProviders(<Button variant="destructive">Delete</Button>);

        const button = screen.getByRole('button', { name: /delete/i });
        expect(button.className).toContain('destructive');
    });

    it('is disabled when disabled prop is true', () => {
        renderWithProviders(<Button disabled>Disabled Button</Button>);

        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
    });
});
