import { Campaign, NotificationAction } from "../../domain/entities/campaign.js"
import { MongoCampaignRepository } from "../../infra/db/mongoose/repositories/mongo-campaign-repository.js"
import { MongoNotificationRepository } from "../../infra/db/mongoose/repositories/mongo-notification-repository.js"
import { pushTo } from "../../infra/webpush/webpush.js"

const campaignRepository = MongoCampaignRepository()
const notificationRepository = MongoNotificationRepository()

function stripHtmlToText(html?: string) {
  if (!html) return ""
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildPayload(campaign: Campaign, notificationId: string) {
  return {
    title: campaign.title,
    body: stripHtmlToText(campaign.body),
    image: campaign.image,
    icon: campaign.icon,
    actions: campaign.actions.map((a: NotificationAction) => ({
      action: a.action,
      title: a.title,
      url: a.url,
    })),
    data: {
      campaignId: String((campaign as any).id || (campaign as any)._id),
      notificationId,
    },
  }
}

export async function sendNotification(
  accountId: string,
  campaignId: string,
  subscriptionId: string,
  endpoint: string,
  keys: { p256dh: string; auth: string }
) {
  const campaign = await campaignRepository.findById(campaignId)

  if (!campaign || campaign.accountId !== accountId) return

  const { id: notificationId } = await notificationRepository.createForSend({
    accountId,
    campaignId,
    subscriptionId,
  })

  const payload = buildPayload(campaign, notificationId)

  try {
    const result = await pushTo(endpoint, keys, payload)

    if (!result.ok) {
      await notificationRepository.markFailed(
        notificationId,
        String(result.statusCode || "ERR"),
        "Push service error"
      )
    }
  } catch (err: any) {
    await notificationRepository.markFailed(notificationId, "ERR", err?.message || "Push send error")
  }
}
