import 'express-async-errors'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import path from 'node:path'
import { clerkMiddleware } from '@clerk/express'
import { subscriptionsRouter } from './presentation/http/routes/subscription-routes'
import { campaignsRouter } from './presentation/http/routes/campaign-routes'
import { notificationRouter } from './presentation/http/routes/notification-routes'
import { vapidRouter } from './presentation/http/routes/vapid-routes'

export const app = express()

app.use(helmet())
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

// habilita CORS para o frontend
app.use(cors({
  origin: ["http://localhost:3001"], // URL do dashboard
  credentials: true,
}))

// servir arquivos estáticos (incluindo subscribe.v1.js) com headers adequados
app.use(
  '/',
  express.static(path.join(process.cwd(), 'public'), {
    index: false,
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    },
  })
)

app.get('/health', (_req, res) => res.json({ ok: true }))

// rotas privadas (autenticadas)
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
