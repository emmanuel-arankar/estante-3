import { renderWithProviders, screen, fireEvent } from './utils';
import { Hero } from '../components/home/Hero';
import { describe, it, expect } from 'vitest';

describe('Hero Component Optimization', () => {
  it('should maintain stable background element positions when typing in search bar', () => {
    const { container } = renderWithProviders(<Hero />);

    // Find background elements
    const backgroundElements = container.querySelectorAll('.bg-white\\/20');
    expect(backgroundElements.length).toBe(20);

    // Capture initial styles
    const initialStyles = Array.from(backgroundElements).map(el => ({
      left: (el as HTMLElement).style.left,
      top: (el as HTMLElement).style.top,
    }));

    // Simulate typing
    const searchInput = screen.getByPlaceholderText(/O que você está procurando/i);
    fireEvent.change(searchInput, { target: { value: 'React' } });

    // Verify styles haven't changed
    const postTypingElements = container.querySelectorAll('.bg-white\\/20');
    const postTypingStyles = Array.from(postTypingElements).map(el => ({
      left: (el as HTMLElement).style.left,
      top: (el as HTMLElement).style.top,
    }));

    expect(postTypingStyles).toEqual(initialStyles);
  });
});
