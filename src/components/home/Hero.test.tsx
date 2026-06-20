import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Hero } from './Hero';
import { BrowserRouter } from 'react-router-dom';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Hero Component Performance Check', () => {
  it('renders and allows search input', () => {
    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText(/O que você está procurando/i);
    fireEvent.change(input, { target: { value: 'Harry Potter' } });
    expect(input.value).toBe('Harry Potter');

    const form = input.closest('form');
    fireEvent.submit(form!);
    expect(mockNavigate).toHaveBeenCalledWith('/search?q=Harry%20Potter');
  });
});
