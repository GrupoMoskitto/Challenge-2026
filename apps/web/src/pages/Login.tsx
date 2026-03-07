import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, gql } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      className="absolute top-4 right-4 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-accent transition-all duration-200"
      aria-label="Alternar tema"
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-yellow-400" />
      ) : (
        <Moon className="h-5 w-5 text-slate-600" />
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <ThemeToggle />
      <Card className="w-full max-w-md bg-card">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-20 h-20 flex items-center justify-center">
            <img src="/logo.svg" alt="Hospital São Rafael" className="w-full h-full object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Hospital São Rafael</CardTitle>
            <CardDescription>Sistema de Gestão de Pacientes</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
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
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
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
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
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
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Credenciais de teste:</p>
            <p className="font-mono text-xs">admin@hsr.com.br / admin123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
