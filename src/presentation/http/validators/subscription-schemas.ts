import { z } from 'zod'
import { SubscriptionStatusEnum } from '../../../domain/enums/subscription-status-enum.js'

export const SubscriptionBody = z.object({
  campaignId: z.string().min(6).optional(),
  accountId: z.string().min(6),
  status: z.nativeEnum(SubscriptionStatusEnum).optional(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(5) })
  }),
  locale: z.string().optional(),
  tags: z.array(z.string()).optional()
})