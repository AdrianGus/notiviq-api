import { Subscription, SubscriptionKeys } from "../../../../domain/entities/subscription.js"
import { Paginated } from "../../../../domain/repositories/paginated-list-dto.js"
import { SubscriptionListFilters, SubscriptionRepository } from "../../../../domain/repositories/subscription-repository.js"
import { SubscriptionModel } from "../models/subscription-model.js"
import { createRepository, escapeRegExp } from "./base-repository.js"

function serialize(d: any): Subscription {
  return {
    id: String(d._id),
    campaignId: String(d.campaignId),
    accountId: String(d.accountId),
    status: d.status,
    endpoint: d.endpoint,
    keys: d.keys as SubscriptionKeys,
    userAgent: d.userAgent ?? undefined,
    locale: d.locale ?? undefined,
    tags: Array.isArray(d.tags) ? d.tags : [],
    lastSeenAt: d.lastSeenAt ?? undefined,
    createdAt: d.createdAt
  }
}

const base = createRepository<Subscription>({ Model: SubscriptionModel as any, serialize })

export const MongoSubscriptionRepository = (): SubscriptionRepository => ({
  async upsert(input) {
    // primeiro tenta achar
    let doc = await SubscriptionModel.findOne({ endpoint: input.endpoint, accountId: input.accountId }).exec()

    if (doc) {
      // atualiza campos
      doc.campaignId = input.campaignId
      doc.status = input.status
      doc.keys = input.keys
      doc.userAgent = input.userAgent
      doc.locale = input.locale
      doc.tags = input.tags ?? []
      doc.lastSeenAt = new Date()

      await doc.save()
    } else {
      // cria novo (igual Account/Campaign)
      doc = new SubscriptionModel({
        accountId: input.accountId,
        campaignId: input.campaignId,
        status: input.status,
        endpoint: input.endpoint,
        keys: input.keys,
        userAgent: input.userAgent,
        locale: input.locale,
        tags: input.tags ?? [],
        lastSeenAt: new Date(),
      })
      await doc.save()
    }

    return serialize(doc)
  },
  async listPaginated(page: number, size: number, filters?: SubscriptionListFilters): Promise<Paginated<Subscription>> {
    const q: any = {}

    if (filters?.campaignId) q.campaignId = filters.campaignId
    if (filters?.tags && filters.tags.length > 0) q.tags = { $in: filters.tags }
    if (filters?.localeStartsWith) q.locale = { $regex: `^${escapeRegExp(filters.localeStartsWith)}`, $options: 'i' }
    if (filters?.q) {
      const like = escapeRegExp(filters.q)
      q.$or = [
        { endpoint: { $regex: like, $options: 'i' } },
        { userAgent: { $regex: like, $options: 'i' } }
      ]
    }

    const skip = (Math.max(1, page) - 1) * Math.max(1, size)
    const [total, docs] = await Promise.all([
      (SubscriptionModel as any).countDocuments(q),
      (SubscriptionModel as any)
        .find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(size)
        .lean()
    ])

    const items = docs.map(serialize)
    const totalPages = Math.max(1, Math.ceil(total / size))
    return { items, total, page, size, totalPages }
  },
  async findById(id) {
    return base.findById(id)
  },
  async update(id, patch) {
    return base.update(id, patch)
  },
  async removeByEndpoint(endpoint) {
    await (SubscriptionModel as any).findOneAndDelete({ endpoint })
  }
})
