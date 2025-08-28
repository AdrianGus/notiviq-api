import webpush from 'web-push'
import { MongoSubscriptionRepository } from '../db/mongoose/repositories/mongo-subscription-repository.js'
import { SubscriptionStatusEnum } from '../../domain/enums/subscription-status-enum.js'

const subject = process.env.VAPID_SUBJECT!
const publicKey = process.env.VAPID_PUBLIC_KEY!
const privateKey = process.env.VAPID_PRIVATE_KEY!

webpush.setVapidDetails(subject, publicKey, privateKey)

const subscriptionRepository = MongoSubscriptionRepository()

export async function pushTo(endpoint: string, keys: { p256dh: string; auth: string }, payload: any) {
  try {
    const res = await webpush.sendNotification({ endpoint, keys }, JSON.stringify(payload), { TTL: 60 })

    return { ok: true, statusCode: res.statusCode }
  } catch (err: any) {
    const gone = err?.statusCode === 404 || err?.statusCode === 410

    if (gone) {
      await subscriptionRepository.update(payload.data.notificationId, { status: SubscriptionStatusEnum.CANCELLED })
    }

    return { ok: false, statusCode: err?.statusCode, gone }
  }
}