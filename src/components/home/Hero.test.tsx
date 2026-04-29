import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Hero } from './Hero';
import { BrowserRouter } from 'react-router-dom';

// Mock useNavigate
const mockedUsedNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    useNavigate: () => mockedUsedNavigate,
  };
});

describe('Hero Component', () => {
  it('renders correctly', () => {
    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    expect(screen.getByText(/Descubra, compartilhe e/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/O que você está procurando?/i)).toBeInTheDocument();
  });

  it('updates search query on change', () => {
    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText(/O que você está procurando?/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Harry Potter' } });
    expect(input.value).toBe('Harry Potter');
  });
});
