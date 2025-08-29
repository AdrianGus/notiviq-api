import 'express-async-errors'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import path from 'node:path'
import { clerkMiddleware } from '@clerk/express'
import { subscriptionsRouter } from './presentation/http/routes/subscription-routes.js'
import { campaignsRouter } from './presentation/http/routes/campaign-routes.js'
import { notificationRouter } from './presentation/http/routes/notification-routes.js'
import { vapidRouter } from './presentation/http/routes/vapid-routes.js'
import { accountsRouter } from './presentation/http/routes/account-routes.js'

export const app = express()

/** --- Config de host/wildcard --- */
const WILDCARD_BASE = process.env.WILDCARD_BASE || '.notiviq.com.br'
const API_HOST_WHITELIST = new Set<string>([
  'api.notiviq.com.br',
  'localhost',
  '127.0.0.1'
])

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
}))

app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

/**
 * CORS global — inclui subdomínios *.notiviq.com.br (iframe/SW)
 */
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:4000',
    'https://notiviq-web-production.up.railway.app',
    'https://dashboard.notiviq.com.br',
    /\.notiviq\.vercel\.app$/,
    /\.notiviq\.com\.br$/, // <— permite vilmar.notiviq.com.br etc.
  ],
  credentials: true,
}))

/**
 * Guard de host: em subdomínios do wildcard (ex.: vilmar.notiviq.com.br),
 * só permitem /sw.js, /iframe.html, /favicon.ico e /icons/*.
 * Bloqueia qualquer outra rota para não expor a API nesses hosts.
 */
app.use((req, res, next) => {
  const host = (req.hostname || '').toLowerCase()
  const isWildcard = host.endsWith(WILDCARD_BASE)
  const isApiHost = API_HOST_WHITELIST.has(host) || host === 'localhost'

  if (isWildcard && !isApiHost) {
    const p = req.path
    const allowed =
      p === '/sw.js' ||
      p === '/iframe.html' ||
      p === '/favicon.ico' ||
      p.startsWith('/icons/')
    if (!allowed) {
      return res.status(404).end()
    }
  }
  next()
})

/**
 * Respostas dedicadas com headers para /sw.js e /iframe.html
 * (em qualquer host; especialmente úteis no wildcard)
 */
app.get('/sw.js', (req, res, next) => {
  const file = path.join(process.cwd(), 'public', 'sw.js')
  res.sendFile(file, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'Service-Worker-Allowed': '/',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  }, (err) => { if (err) next(err) })
})

app.get('/iframe.html', (req, res, next) => {
  res.sendFile(path.join(process.cwd(), 'public', 'iframe.html'), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      // Permitir que QUALQUER site embele o iframe (zero fricção)
      'Content-Security-Policy': "frame-ancestors *",
      // Compatibilidade com navegadores antigos (não padrão, mas inofensivo aqui)
      'X-Frame-Options': 'ALLOWALL',
    },
  }, (err) => { if (err) next(err) })
})

/**
 * Estáticos restantes (subscribe.v1.js etc.)
 */
app.use(
  '/',
  express.static(path.join(process.cwd(), 'public'), {
    index: false,
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
      if (filePath.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-store')
      }
    },
  })
)

app.get('/health', (_req, res) => res.json({ ok: true }))

// rotas privadas (auth obrigatória)
app.use(clerkMiddleware())
app.use('/vapid', vapidRouter)
app.use('/accounts', accountsRouter)
app.use('/campaigns', campaignsRouter)
app.use('/subscriptions', subscriptionsRouter)
app.use('/notifications', notificationRouter)

// fallback de erro
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err)
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Internal Server Error' })
})
