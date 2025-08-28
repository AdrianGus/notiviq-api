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

export const app = express()

app.use(helmet())
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

/**
 * CORS global — permite o dashboard e também outros domínios (p/ embed).
 * Ajuste "origin" para incluir o domínio público do seu dashboard em produção.
 */
app.use(cors({
  origin: [
    "http://localhost:3001",           // dashboard local
    "http://localhost:4000",
    "https://notiviq-web-production.up.railway.app",
    /\.notiviq\.vercel\.app$/,         // regex p/ permitir subdomínios (produção)
  ],
  credentials: true,
}))

/**
 * Rota pública de arquivos estáticos (scripts de embed, service worker, etc.)
 * Ex: /subscribe.v1.js e /sw.js
 */
app.use(
  '/',
  express.static(path.join(process.cwd(), 'public'), {
    index: false,
    setHeaders: (res, filePath) => {
      // headers p/ permitir consumo cross-origin
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
      // força cache curto p/ facilitar testes
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
app.use('/campaigns', campaignsRouter)
app.use('/subscriptions', subscriptionsRouter)
app.use('/notifications', notificationRouter)

// fallback de erro
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err)
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Internal Server Error' })
})
