import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, gql } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setAuthToken } from '@/lib/apollo';
import { validateEmail, sanitizeInput } from '@/lib/validation';
import { Loader2, Moon, Sun } from 'lucide-react';

const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      refreshToken
      user {
        id
        name
        email
        role
      }
    }
  }
`;

interface LoginResponse {
  login: {
    token: string;
    refreshToken: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  };
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return 'dark';
    if (stored === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    window.dispatchEvent(new CustomEvent('theme-transition'));
  };

  return (
    <button
      onClick={toggle}
      className="absolute top-5 right-5 z-20 w-11 h-11 rounded-xl glass flex items-center justify-center hover:scale-105 transition-all duration-200"
      aria-label="Alternar tema"
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-yellow-400" />
      ) : (
        <Moon className="h-5 w-5 text-slate-700" />
      )}
    </button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const [login, { loading }] = useMutation<LoginResponse>(LOGIN_MUTATION, {
    onCompleted: (data) => {
      setAuthToken(data.login.token, data.login.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.login.user));
      setAttempts(0);
      navigate('/');
    },
    onError: (err) => {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= 5) {
        setError('Muitas tentativas falhas. Aguarde 5 minutos.');
      } else {
        setError(err.message || 'Falha ao fazer login');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const sanitizedEmail = sanitizeInput(email);
    
    if (!validateEmail(sanitizedEmail)) {
      setError('E-mail inválido');
      return;
    }
    
    if (password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    if (attempts >= 5) {
      setError('Muitas tentativas falhas. Aguarde 5 minutos.');
      return;
    }
    
    login({ variables: { input: { email: sanitizedEmail, password } } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Hero Background */}
      <div className="absolute inset-0 animate-fade-in-bg">
        <img
          src="/hero.jpg"
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
        {/* Dark overlay with gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/70" />
        {/* Subtle color tint */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent" />
      </div>

      <ThemeToggle />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="glass rounded-2xl p-8 space-y-6">
          {/* Logo & Title */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 flex items-center justify-center glass-subtle rounded-2xl p-3">
              <img src="/logo.svg" alt="Hospital São Rafael" className="w-full h-full object-contain drop-shadow-lg" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Hospital São Rafael
              </h1>
              <p className="text-sm text-slate-600 dark:text-white/60 mt-1">
                Sistema de Gestão de Pacientes
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 dark:text-red-200 bg-red-500/20 rounded-lg border border-red-500/20">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-800 dark:text-white/80">
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="glass-input h-11 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/35"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-800 dark:text-white/80">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="glass-input h-11 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/35"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 rounded-xl glass-button text-white font-semibold text-sm border-0"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300 dark:border-white/10" />
            </div>
          </div>

          {/* Test credentials */}
          <div className="text-center text-sm text-slate-600 dark:text-white/40 pt-2">
            <p>Credenciais de teste:</p>
            <p className="font-mono text-xs text-slate-700 dark:text-white/50 mt-1">admin@hsr.com.br / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
