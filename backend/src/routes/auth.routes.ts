import { Router, type Request, type Response } from 'express';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';
import {
  AuthError,
  changePassword,
  getCurrentUser,
  login,
  logout,
  refreshSession,
} from '../services/auth.service.js';
import { getRefreshTokenTtlMs } from '../security/token.js';

export const authRouter = Router();

const cookieName = process.env.REFRESH_COOKIE_NAME?.trim() || 'semilla_refresh_token';
const cookiePath = '/api/auth';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(cookieName, refreshToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'none' : 'lax',
    path: cookiePath,
    maxAge: getRefreshTokenTtlMs(),
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'none' : 'lax',
    path: cookiePath,
  });
}

function readCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }

  for (const item of cookieHeader.split(';')) {
    const separatorIndex = item.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = item.slice(0, separatorIndex).trim();
    if (key === name) {
      const rawValue = item.slice(separatorIndex + 1).trim();

      try {
        return decodeURIComponent(rawValue);
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function requestMetadata(req: Request) {
  return {
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') ?? null,
  };
}

function handleError(res: Response, error: unknown): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof Error && error.message.startsWith('La contraseña')) {
    res.status(400).json({ message: error.message });
    return;
  }

  console.error('Error de autenticación:', error);
  res.status(500).json({ message: 'No fue posible completar la operación de autenticación.' });
}

authRouter.post('/login', async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const result = await login(email, password, requestMetadata(req));

    setRefreshCookie(res, result.refreshToken);
    res.json({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      usuario: result.usuario,
    });
  } catch (error) {
    handleError(res, error);
  }
});

authRouter.post('/refresh', async (req, res) => {
  try {
    const refreshToken = readCookie(req, cookieName);
    const result = await refreshSession(refreshToken ?? '', requestMetadata(req));

    setRefreshCookie(res, result.refreshToken);
    res.json({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      usuario: result.usuario,
    });
  } catch (error) {
    clearRefreshCookie(res);
    handleError(res, error);
  }
});

authRouter.post('/logout', async (req, res) => {
  try {
    const refreshToken = readCookie(req, cookieName);
    await logout(refreshToken, req.auth?.sub);
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
});

authRouter.get('/me', authenticateAccessToken, async (req, res) => {
  try {
    const usuario = await getCurrentUser(req.auth!.sub);
    res.json({ usuario });
  } catch (error) {
    handleError(res, error);
  }
});

authRouter.post('/cambiar-contrasena', authenticateAccessToken, async (req, res) => {
  try {
    const currentPassword =
      typeof req.body?.contrasenaActual === 'string' ? req.body.contrasenaActual : '';
    const newPassword = typeof req.body?.contrasenaNueva === 'string' ? req.body.contrasenaNueva : '';

    if (!currentPassword || !newPassword) {
      throw new AuthError(400, 'La contraseña actual y la nueva son obligatorias.');
    }

    await changePassword(req.auth!.sub, currentPassword, newPassword);
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
});
