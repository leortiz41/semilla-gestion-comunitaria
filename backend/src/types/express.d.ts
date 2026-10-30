import type { AccessTokenClaims } from '../security/token.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenClaims;
    }
  }
}

export {};
