import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/utils';
import { Hero } from './Hero';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Hero', () => {
    it('renders hero title and subtitle', () => {
        renderWithProviders(<Hero />);

        expect(screen.getByText(/Descubra, compartilhe e/i)).toBeInTheDocument();
        expect(screen.getByText(/Sua biblioteca pessoal que cabe na palma da mão/i)).toBeInTheDocument();
    });

    it('updates search query on change', () => {
        renderWithProviders(<Hero />);

        const input = screen.getByPlaceholderText(/O que você está procurando?/i);
        fireEvent.change(input, { target: { value: 'O Senhor dos Anéis' } });

        expect(input).toHaveValue('O Senhor dos Anéis');
    });

    it('navigates to search page on form submission', () => {
        renderWithProviders(<Hero />);

        const input = screen.getByPlaceholderText(/O que você está procurando?/i);
        fireEvent.change(input, { target: { value: 'Hobbit' } });

        const form = input.closest('form');
        if (form) {
            fireEvent.submit(form);
        }

        expect(mockNavigate).toHaveBeenCalledWith('/search?q=Hobbit');
    });

    it('renders stats', () => {
        renderWithProviders(<Hero />);

        expect(screen.getByText(/\+50M/i)).toBeInTheDocument();
        expect(screen.getByText(/Livros cadastrados/i)).toBeInTheDocument();
        expect(screen.getByText(/\+10M/i)).toBeInTheDocument();
        expect(screen.getByText(/Usuários/i)).toBeInTheDocument();
    });
});
