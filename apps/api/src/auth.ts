import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { logger } from './config/logger';

const isProduction = process.env.NODE_ENV === 'production';

const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? (() => { throw new Error('JWT_SECRET is required in production'); })() : 'dev-secret-do-not-use-in-prod');
const REFRESH_SECRET = process.env.REFRESH_SECRET || (isProduction ? (() => { throw new Error('REFRESH_SECRET is required in production'); })() : 'dev-refresh-secret-do-not-use-in-prod');

// --- Redis connection for token blacklist & rate limiting ---

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const authRedis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy: (times: number) => Math.min(times * 100, 3000),
});

authRedis.on('error', (err: Error) => {
  logger.error('Auth:Redis', 'Redis connection error', err);
});

authRedis.on('connect', () => {
  logger.info('Auth:Redis', 'Connected to Redis for auth services');
});

// Connect lazily — errors won't crash startup
authRedis.connect().catch((err: unknown) => {
  logger.warn('Auth:Redis', 'Initial Redis connection failed, will retry', err);
});

// --- Token Blacklist (Revocation) ---

const BLACKLIST_PREFIX = 'token_blacklist:';
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds (matches refresh token expiry)

/**
 * Revokes all tokens for a user by adding their userId to the Redis blacklist.
 * Called when admin deactivates a user via toggleUserStatus.
 */
export async function revokeUserTokens(userId: string): Promise<void> {
  try {
    await authRedis.set(
      `${BLACKLIST_PREFIX}${userId}`,
      Date.now().toString(),
      'EX',
      REFRESH_TOKEN_TTL
    );
    logger.info('Auth:Revocation', `Tokens revoked for user ${userId}`);
  } catch (err) {
    logger.error('Auth:Revocation', `Failed to revoke tokens for user ${userId}`, err);
    // Don't throw — deactivation should still proceed even if Redis is down
  }
}

/**
 * Checks if a user's tokens have been revoked.
 * Returns the revocation timestamp if revoked, null otherwise.
 */
export async function isTokenRevoked(userId: string): Promise<boolean> {
  try {
    const revocationTimestamp = await authRedis.get(`${BLACKLIST_PREFIX}${userId}`);
    return revocationTimestamp !== null;
  } catch (err) {
    logger.error('Auth:Revocation', `Failed to check revocation for user ${userId}`, err);
    // Fail open in dev, fail closed in production
    return isProduction;
  }
}

/**
 * Clears the revocation entry for a user (when re-activated).
 */
export async function clearTokenRevocation(userId: string): Promise<void> {
  try {
    await authRedis.del(`${BLACKLIST_PREFIX}${userId}`);
    logger.info('Auth:Revocation', `Revocation cleared for user ${userId}`);
  } catch (err) {
    logger.error('Auth:Revocation', `Failed to clear revocation for user ${userId}`, err);
  }
}

// --- Login Rate Limiting (in-memory fallback, production uses Redis via express-rate-limit) ---

const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const CLEANUP_INTERVAL = 60 * 60 * 1000;

function cleanupOldAttempts(): void {
  const now = Date.now();
  for (const ip of loginAttempts.keys()) {
    const attempt = loginAttempts.get(ip);
    if (attempt && now - attempt.firstAttempt > RATE_LIMIT_WINDOW) {
      loginAttempts.delete(ip);
    }
  }
}

setInterval(cleanupOldAttempts, CLEANUP_INTERVAL);
cleanupOldAttempts();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  
  if (!attempt || now - attempt.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return true;
  }
  
  if (attempt.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false;
  }
  
  attempt.count++;
  return true;
}

export function resetRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

// --- JWT Types & Functions ---

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12); // Increased from 10 to 12 rounds for production
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
  } catch {
    return null;
  }
};

// --- Cookie Configuration ---

export const COOKIE_OPTIONS = {
  ACCESS_TOKEN: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' as const : 'lax' as const,
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  },
  REFRESH_TOKEN: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' as const : 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/auth/refresh',
  },
  CLEAR: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' as const : 'lax' as const,
    maxAge: 0,
    path: '/',
  },
};
