import type { Request, Response } from 'express'
import { CampaignInput } from '../validators/campaign-schemas.js'
import { MongoCampaignRepository } from '../../../infra/db/mongoose/repositories/mongo-campaign-repository.js'
import { MongoSubscriptionRepository } from '../../../infra/db/mongoose/repositories/mongo-subscription-repository.js'
import { pushTo } from '../../../infra/webpush/webpush.js'
import { CampaignScheduleModeEnum } from '../../../domain/enums/campaign-schedule-mode-enum.js'
import { CampaignStatusEnum } from '../../../domain/enums/campaign-status-enum.js'

const campaignRepository = MongoCampaignRepository()
const subscriptionRepository = MongoSubscriptionRepository()

export class CampaignController {
  static async list(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1
    const size = parseInt(req.query.size as string) || 12


    let status: CampaignStatusEnum | undefined
    let mode: CampaignScheduleModeEnum | undefined

    if (req.query.status && Object.values(CampaignStatusEnum).includes(req.query.status as any)) {
      status = req.query.status as CampaignStatusEnum
    }

    if (req.query.mode && Object.values(CampaignScheduleModeEnum).includes(req.query.mode as any)) {
      mode = req.query.mode as CampaignScheduleModeEnum
    }

    const q = (req.query.q as string | undefined) || undefined

    const result = await campaignRepository.listPaginated(page, size, {
      status,
      mode,
      q
    })

    return res.json(result)
  }

  static async get(req: Request, res: Response) {
    const item = await campaignRepository.findById(req.params.id)

    if (!item) return res.status(404).json({ error: 'Not found' })

    return res.json(item)
  }

  static async create(req: Request, res: Response) {
    const parsed = CampaignInput.safeParse(req.body)

    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const actions = parsed.data.actions.map((a) => ({
      action: a.action ? a.action : a.title.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
      title: a.title,
      url: a.url
    }))

    const created = await campaignRepository.create({
      status: parsed.data.status,
      title: parsed.data.title,
      icon: parsed.data.icon,
      body: parsed.data.body,
      image: parsed.data.image,
      actions: actions,
      target: parsed.data.target ? parsed.data.target : { tags: [] },
      schedule: {
        mode: parsed.data.schedule.mode,
        startAt: parsed.data.schedule.startAt,
        interval: parsed.data.schedule.interval,
        endAt: parsed.data.schedule.endAt
      },
    })

    return res.status(201).json(created)
  }

  static async update(req: Request, res: Response) {
    const parsed = CampaignInput.partial().safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const updated = await campaignRepository.update(req.params.id, {
      ...parsed.data,
      actions: parsed.data.actions ? parsed.data.actions.map((a) => ({
        action: a.action ? a.action : a.title.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
        title: a.title,
        url: a.url
      })) : undefined,
      schedule: parsed.data.schedule
        ? {
          mode: parsed.data.schedule.mode,
          startAt: parsed.data.schedule.startAt,
          interval: parsed.data.schedule.interval,
          endAt: parsed.data.schedule.endAt
        }
        : undefined
    })

    if (!updated) {
      return res.status(404).json({ error: 'Not found' })
    }

    return res.json(updated)
  }

  static async remove(req: Request, res: Response) {
    await campaignRepository.delete(req.params.id)

    return res.status(204).send()
  }

  static async notifyTest(req: Request, res: Response) {
    try {
      const { id } = req.params // campaignId

      // busca subscrições por campanha
      const subs = await subscriptionRepository.listPaginated(1, 100, {
        campaignId: id
      })

      console.log(subs, id)

      if (!subs.items.length) {
        return res.status(404).json({ error: "Nenhuma subscrição encontrada" })
      }

      const payload = {
        title: "Notificação de Teste",
        body: `Essa é uma notificação de teste para a campanha ${id}`,
        icon: "/icon.png",
      }

      const results = await Promise.all(
        subs.items.map(async (s) => {
          const result = await pushTo(s.endpoint, s.keys, payload)

          return result
        })
      )

      const sent = results.filter(r => r.ok).length
      const failed = results.length - sent

      return res.json({ sent, failed, total: results.length })
    } catch (err: any) {
      console.error(err)
      return res.status(500).json({ error: err.message })
    }
  }
}