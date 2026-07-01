import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { Hero } from './Hero';

// Mock router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('Hero', () => {
  it('renders Hero component elements', () => {
    renderWithProviders(<Hero />);

    expect(screen.getByText(/Descubra, compartilhe e/i)).toBeInTheDocument();
    expect(screen.getByText(/colecione seus livros favoritos/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/O que você está procurando\?/i)).toBeInTheDocument();
    expect(screen.getByText(/\+50M/i)).toBeInTheDocument();
    expect(screen.getByText(/Livros cadastrados/i)).toBeInTheDocument();
  });

  it('renders search input with correct value', async () => {
    renderWithProviders(<Hero />);
    const searchInput = screen.getByPlaceholderText(/O que você está procurando\?/i) as HTMLInputElement;
    expect(searchInput.value).toBe('');
  });
});
