import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from './RegisterForm';

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
    useLocation: () => ({ pathname: '/register', state: null }),
    Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  };
});

// Mock toast
vi.mock('@/components/ui/toast', () => ({
  toastSuccessClickable: vi.fn(),
  toastErrorClickable: vi.fn(),
}));

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders register form elements', () => {
    renderWithProviders(<RegisterForm />);

    expect(screen.getByPlaceholderText(/seu nome completo/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/seu email principal/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/sua senha \(mín\. 6 caracteres\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^criar conta$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    const passwordInput = screen.getByPlaceholderText(/sua senha/i) as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button

    expect(passwordInput.type).toBe('password');

    await user.click(toggleButton);
    expect(passwordInput.type).toBe('text');

    await user.click(toggleButton);
    expect(passwordInput.type).toBe('password');
  });

  it('shows link to login', () => {
    renderWithProviders(<RegisterForm />);

    const loginLink = screen.getByRole('link', { name: /faça login/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('validates required fields', async () => {
    renderWithProviders(<RegisterForm />);

    const nameInput = screen.getByPlaceholderText(/seu nome completo/i);
    const emailInput = screen.getByPlaceholderText(/seu email principal/i);
    const passwordInput = screen.getByPlaceholderText(/sua senha/i);

    expect(nameInput).toHaveAttribute('required');
    expect(emailInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('minLength', '6');
  });
});
