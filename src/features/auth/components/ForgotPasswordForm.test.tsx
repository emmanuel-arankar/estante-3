import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { ForgotPasswordForm } from './ForgotPasswordForm';

// Mock Firebase
vi.mock('@/services/firebase/firebase', () => ({
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
        useLocation: () => ({ pathname: '/forgot-password', state: null }),
        Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
        Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    };
});

// Mock toast
vi.mock('@/components/ui/toast', () => ({
    toastSuccessClickable: vi.fn(),
    toastErrorClickable: vi.fn(),
}));

describe('ForgotPasswordForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders forgot password elements', () => {
        renderWithProviders(<ForgotPasswordForm />);

        expect(screen.getByPlaceholderText(/seu email cadastrado/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /enviar link de recuperação/i })).toBeInTheDocument();
    });

    it('shows link back to login', () => {
        renderWithProviders(<ForgotPasswordForm />);

        const loginLink = screen.getByRole('link', { name: /fazer login/i });
        expect(loginLink).toBeInTheDocument();
        expect(loginLink).toHaveAttribute('href', '/login');
    });

    it('validates required email field', async () => {
        renderWithProviders(<ForgotPasswordForm />);

        const emailInput = screen.getByPlaceholderText(/seu email cadastrado/i);
        expect(emailInput).toHaveAttribute('type', 'email');
    });
});