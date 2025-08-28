import { Router } from 'express'

export const vapidRouter = Router()

vapidRouter.get("/", (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || ""
  if (!key) return res.status(500).json({ error: "VAPID_PUBLIC_KEY não configurada" })
  res.json({ publicKey: key })
})
