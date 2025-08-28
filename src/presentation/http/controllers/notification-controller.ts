import type { Request, Response } from "express"
import { MongoNotificationRepository } from "../../../infra/db/mongoose/repositories/mongo-notification-repository"
import { NotificationStatusEnum } from "../../../domain/enums/notification-status-enum"

const notificationRepository = MongoNotificationRepository()

function parseTs(ts?: unknown): Date | undefined {
  if (!ts) return undefined
  const d = new Date(String(ts))
  return isNaN(d.getTime()) ? undefined : d
}

export class NotificationController {
  static async list(req: Request, res: Response) {
    const page = parseInt(String(req.query.page || "1"), 10) || 1
    const size = parseInt(String(req.query.size || "12"), 10) || 12

    const subscriptionId = (req.query.subscriptionId as string | undefined) || undefined
    const campaignId = (req.query.campaignId as string | undefined) || undefined

    const statusParam = (req.query.status as string | undefined) || undefined
    let status: NotificationStatusEnum | NotificationStatusEnum[] | undefined = undefined
    if (statusParam) {
      const parts = statusParam.split(",").map(s => s.trim()).filter(Boolean) as NotificationStatusEnum[]
      status = parts.length > 1 ? parts : parts[0]
    }

    const createdFrom = req.query.createdFrom ? parseTs(req.query.createdFrom) : undefined
    const createdTo = req.query.createdTo ? parseTs(req.query.createdTo) : undefined

    const result = await notificationRepository.listPaginated(page, size, {
      subscriptionId,
      campaignId,
      status,
      createdFrom,
      createdTo
    })

    return res.json(result)
  }

  static async markShown(req: Request, res: Response) {
    const { id } = req.params

    const at = parseTs(req.body?.ts)

    await notificationRepository.markShown(id, at)

    return res.status(201).json({ ok: true })
  }

  static async markClicked(req: Request, res: Response) {
    const { id } = req.params

    const { action, ts } = (req.body || {}) as { action?: string; ts?: string }

    const at = parseTs(ts)

    await notificationRepository.markClicked(id, action, at)

    return res.status(201).json({ ok: true })
  }

  static async markClosed(req: Request, res: Response) {
    const { id } = req.params

    const at = parseTs(req.body?.ts)

    await notificationRepository.markClosed(id, at)

    return res.status(201).json({ ok: true })
  }
}