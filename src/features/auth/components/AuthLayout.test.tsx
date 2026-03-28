import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react'; // Usar render básico
import { AuthLayout } from './AuthLayout';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock Framer Motion - Evita problemas com animações em testes unitários
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('AuthLayout', () => {
  it('renders branding and static content', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/" element={<AuthLayout />}>
            <Route path="login" element={<div>Login Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Estante de Bolso/i)).toBeInTheDocument();
    expect(screen.getByText(/Sua jornada literária começa aqui/i)).toBeInTheDocument();
    expect(screen.getByText(/Conecte-se com outros leitores/i)).toBeInTheDocument();
  });

  it('renders child routes through Outlet', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/" element={<AuthLayout />}>
            <Route path="login" element={<div data-testid="login-content">Login Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('login-content')).toBeInTheDocument();
    expect(screen.getByText(/Login Content/i)).toBeInTheDocument();
  });

  it('renders register content when on register route', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/" element={<AuthLayout />}>
            <Route path="register" element={<div data-testid="register-content">Register Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('register-content')).toBeInTheDocument();
  });
});
