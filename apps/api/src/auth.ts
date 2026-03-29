import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const isProduction = process.env.NODE_ENV === 'production';

const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? (() => { throw new Error('JWT_SECRET environment variable is required in production'); })() : 'dev-secret-do-not-use-in-prod');
const REFRESH_SECRET = process.env.REFRESH_SECRET || (isProduction ? (() => { throw new Error('REFRESH_SECRET environment variable is required in production'); })() : 'dev-refresh-secret-do-not-use-in-prod');

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
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
