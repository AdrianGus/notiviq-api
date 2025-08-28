import { CampaignRepository, CampaignListFilters } from "../../../../domain/repositories/campaign-repository.js"
import { CampaignModel } from "../models/campaign-model.js"
import { createRepository, escapeRegExp } from "./base-repository.js"

function serialize(doc: any) {
  return {
    id: String(doc._id),
    accountId: String(doc.accountId),
    status: doc.status,
    title: doc.title,
    body: doc.body,
    image: doc.image,
    icon: doc.icon,
    actions: doc.actions,
    target: doc.target,
    schedule: doc.schedule,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  }
}

const base = createRepository({ Model: CampaignModel as any, serialize })

export const MongoCampaignRepository = (): CampaignRepository => ({
  async create(input) {
    return base.create(input)
  },
  async list() {
    return base.list()
  },
  async listPaginated(page: number, size: number, filters?: CampaignListFilters) {
    const q: any = {}

    if (filters?.status) q.status = filters.status
    if (filters?.mode) q["schedule.mode"] = filters.mode
    if (filters?.q) {
      const like = escapeRegExp(filters.q)
      q.$or = [
        { title: { $regex: like, $options: 'i' } },
        { body: { $regex: like, $options: 'i' } }
      ]
    }

    const skip = (page - 1) * size

    const [items, total] = await Promise.all([
      CampaignModel.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(size)
        .lean(),
      CampaignModel.countDocuments()
    ])

    return {
      items: items.map(serialize),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size)
    }
  },
  async findById(id) {
    return base.findById(id)
  },
  async update(id, patch) {
    return base.update(id, patch)
  },
  async delete(id) {
    await base.delete(id)
  }
})