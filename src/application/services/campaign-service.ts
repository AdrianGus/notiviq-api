import { MongoSubscriptionRepository } from "../../infra/db/mongoose/repositories/mongo-subscription-repository.js"
import { sendNotification } from "./notification-service.js"

const subscriptionRepository = MongoSubscriptionRepository()

const SUBSCRIPTIONS_PAGE_SIZE = parseInt(process.env.SUBS_PAGE_SIZE || "500", 10)

export async function dispatchCampaign(campaignId: string, accountId: string) {
  console.info(`[crons] dispatching campaign ${campaignId} for account ${accountId}`)
  let page = 1
  const size = SUBSCRIPTIONS_PAGE_SIZE

  while (true) {
    const result = await subscriptionRepository.listPaginated(page, size, { campaignId })

    const subscriptions = result.items

    if (!subscriptions.length) break

    for (const subscription of subscriptions) {
      await sendNotification(accountId, campaignId, subscription.id, subscription.endpoint, subscription.keys)
    }

    if (subscriptions.length < size) break
    page += 1
  }
}