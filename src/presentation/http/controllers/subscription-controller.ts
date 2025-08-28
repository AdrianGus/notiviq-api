import type { Request, Response } from 'express'
import { SubscriptionBody } from '../validators/subscription-schemas.js'
import { MongoSubscriptionRepository } from '../../../infra/db/mongoose/repositories/mongo-subscription-repository.js'
import { SubscriptionStatusEnum } from '../../../domain/enums/subscription-status-enum.js'

const subscriptionRepository = MongoSubscriptionRepository()

export class SubscriptionController {
  static async subscribe(req: Request, res: Response) {
    const parsed = SubscriptionBody.safeParse(req.body)

    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { accountId, campaignId, status, subscription, locale, tags } = parsed.data

    const created = await subscriptionRepository.upsert({
      accountId: accountId,
      campaignId: campaignId,
      status: status ? status : SubscriptionStatusEnum.REGISTERED,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: req.headers['user-agent'] as string,
      locale,
      tags
    })

    return res.status(200).json({ ok: true, id: created.id })
  }
  static async list(req: Request, res: Response) {
    const page = parseInt(String(req.query.page || '1'), 10) || 1
    const size = parseInt(String(req.query.size || '12'), 10) || 12

    // filtros
    const campaignId = (req.query.campaignId as string | undefined) || undefined
    const tagsParam = (req.query.tags as string | undefined) || undefined
    const tags = tagsParam ? tagsParam.split(',').map(s => s.trim()).filter(Boolean) : undefined
    const localeStartsWith = (req.query.locale as string | undefined) || undefined
    const q = (req.query.q as string | undefined) || undefined

    const result = await subscriptionRepository.listPaginated(page, size, {
      campaignId,
      tags,
      localeStartsWith,
      q
    })

    return res.json(result)
  }
  static async update(req: Request, res: Response) {
    const parsed = SubscriptionBody.partial().safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const updated = await subscriptionRepository.update(req.params.id, {
      status: parsed.data.status
    })

    if (!updated) {
      return res.status(404).json({ error: 'Not found' })
    }

    return res.json(updated)
  }
  static async get(req: Request, res: Response) {
    const item = await subscriptionRepository.findById(req.params.id)

    if (!item) return res.status(404).json({ error: 'Not found' })

    return res.json(item)
  }
}