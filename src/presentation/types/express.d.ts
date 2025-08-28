import 'express-serve-static-core'
import type { AuthClaims } from '../../infra/security/jwt.js'

declare module 'express-serve-static-core' {
  interface Request {
    tenant?: { accountId?: string; }
  }
}