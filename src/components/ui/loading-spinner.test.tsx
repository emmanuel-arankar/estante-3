import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { LoadingSpinner } from './loading-spinner';

describe('LoadingSpinner', () => {
    it('renders spinner', () => {
        const { container } = renderWithProviders(<LoadingSpinner />);

        // Loader2 from lucide-react renders as svg
        const spinner = container.querySelector('svg');
        expect(spinner).toBeInTheDocument();
        expect(spinner).toHaveClass('animate-spin');
    });

    it('renders different sizes', () => {
        const { container, rerender } = renderWithProviders(<LoadingSpinner size="sm" />);

        let spinner = container.querySelector('svg');
        expect(spinner).toHaveClass('h-4');
        expect(spinner).toHaveClass('w-4');

        rerender(<LoadingSpinner size="lg" />);
        spinner = container.querySelector('svg');
        expect(spinner).toHaveClass('h-8');
        expect(spinner).toHaveClass('w-8');
    });

    it('applies custom className', () => {
        const { container } = renderWithProviders(<LoadingSpinner className="text-blue-500" />);

        const spinner = container.querySelector('svg');
        expect(spinner).toHaveClass('text-blue-500');
    });
});
