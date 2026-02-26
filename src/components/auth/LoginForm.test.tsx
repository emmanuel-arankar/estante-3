import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: null },
    db: {},
}));

// Mock router
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigation: () => ({ state: 'idle' }),
        useNavigate: () => vi.fn(),
        useLocation: () => ({ state: null }),
        Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
        Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    };
});

// Mock toast
vi.mock('@/components/ui/toast', () => ({
    toastSuccessClickable: vi.fn(),
    toastErrorClickable: vi.fn(),
}));

// Mock utils
vi.mock('@/utils/nickname', () => ({
    generateUniqueNickname: vi.fn(() => Promise.resolve('nickname123')),
}));

describe('LoginForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders login form elements', () => {
        renderWithProviders(<LoginForm />);

        expect(screen.getByPlaceholderText(/seu email/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/sua senha/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /entrar com google/i })).toBeInTheDocument();
    });

    it('toggles password visibility', async () => {
        const user = userEvent.setup();
        renderWithProviders(<LoginForm />);

        const passwordInput = screen.getByPlaceholderText(/sua senha/i) as HTMLInputElement;
        const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button

        expect(passwordInput.type).toBe('password');

        await user.click(toggleButton);
        expect(passwordInput.type).toBe('text');

        await user.click(toggleButton);
        expect(passwordInput.type).toBe('password');
    });

    it('shows "Lembrar de mim" checkbox', () => {
        renderWithProviders(<LoginForm />);

        expect(screen.getByText(/lembrar de mim/i)).toBeInTheDocument();
    });

    it('shows link to forgot password', () => {
        renderWithProviders(<LoginForm />);

        const forgotLink = screen.getByRole('link', { name: /esqueci minha senha/i });
        expect(forgotLink).toBeInTheDocument();
        expect(forgotLink).toHaveAttribute('href', '/forgot-password');
    });

    it('shows link to register', () => {
        renderWithProviders(<LoginForm />);

        const registerLink = screen.getByRole('link', { name: /cadastre-se/i });
        expect(registerLink).toBeInTheDocument();
        expect(registerLink).toHaveAttribute('href', '/register');
    });

    it('validates required email field', async () => {
        const user = userEvent.setup();
        renderWithProviders(<LoginForm />);

        const submitButton = screen.getByRole('button', { name: /^entrar$/i });
        const emailInput = screen.getByPlaceholderText(/seu email/i) as HTMLInputElement;

        expect(emailInput).toHaveAttribute('required');
    });

    it('validates required password field', () => {
        renderWithProviders(<LoginForm />);

        const passwordInput = screen.getByPlaceholderText(/sua senha/i) as HTMLInputElement;

        expect(passwordInput).toHaveAttribute('required');
    });
});
