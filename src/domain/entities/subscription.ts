import { SubscriptionStatusEnum } from "../enums/subscription-status-enum.js";

export type SubscriptionKeys = { p256dh: string; auth: string }

export type Subscription = {
  id: string
  campaignId?: string
  accountId: string
  status: SubscriptionStatusEnum
  endpoint: string
  keys: SubscriptionKeys
  userAgent?: string
  locale?: string
  tags?: string[]
  lastSeenAt?: Date
  createdAt: Date
}