/**
 * Logger utilitário para o CRMed API
 * Formata logs de forma limpa e legível
 */

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const getPrefix = (level: LogLevel, context: string): string => {
  const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const prefixes: Record<LogLevel, { color: string; label: string }> = {
    info: { color: COLORS.blue, label: 'INFO' },
    success: { color: COLORS.green, label: 'OK' },
    warn: { color: COLORS.yellow, label: 'WARN' },
    error: { color: COLORS.red, label: 'ERR' },
    debug: { color: COLORS.gray, label: 'DBG' },
  };

  const { color, label } = prefixes[level];
  return `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color}[${label}]${COLORS.reset} ${COLORS.cyan}[${context}]${COLORS.reset}`;
};

export const logger = {
  info: (context: string, message: string, data?: unknown) => {
    console.log(`${getPrefix('info', context)} ${message}`);
    if (data && process.env.NODE_ENV !== 'production') {
      console.log(`${COLORS.gray}  └─ ${JSON.stringify(data, null, 2)}${COLORS.reset}`);
    }
  },

  success: (context: string, message: string, data?: unknown) => {
    console.log(`${getPrefix('success', context)} ${message}`);
    if (data && process.env.NODE_ENV !== 'production') {
      console.log(`${COLORS.gray}  └─ ${JSON.stringify(data, null, 2)}${COLORS.reset}`);
    }
  },

  warn: (context: string, message: string, data?: unknown) => {
    console.warn(`${getPrefix('warn', context)} ${message}`);
    if (data) {
      console.warn(`${COLORS.gray}  └─ ${JSON.stringify(data, null, 2)}${COLORS.reset}`);
    }
  },

  error: (context: string, message: string, error?: unknown) => {
    console.error(`${getPrefix('error', context)} ${message}`);
    if (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error, null, 2);
      console.error(`${COLORS.red}  └─ ${errorMessage}${COLORS.reset}`);
    }
  },

  debug: (context: string, message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      console.log(`${getPrefix('debug', context)} ${message}`);
      if (data) {
        console.log(`${COLORS.gray}  └─ ${JSON.stringify(data, null, 2)}${COLORS.reset}`);
      }
    }
  },
};
