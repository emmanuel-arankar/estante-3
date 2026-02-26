import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { Label } from './label';

describe('Label', () => {
    it('renders label text', () => {
        renderWithProviders(<Label>Email Address</Label>);

        expect(screen.getByText(/email address/i)).toBeInTheDocument();
    });

    it('associates with input via htmlFor', () => {
        renderWithProviders(
            <>
                <Label htmlFor="email-input">Email</Label>
                <input id="email-input" />
            </>
        );

        const label = screen.getByText(/email/i) as HTMLLabelElement;
        expect(label.htmlFor).toBe('email-input');
    });

    it('applies custom className', () => {
        renderWithProviders(<Label className="custom-label">Test</Label>);

        const label = screen.getByText(/test/i);
        expect(label.className).toContain('custom-label');
    });
});
