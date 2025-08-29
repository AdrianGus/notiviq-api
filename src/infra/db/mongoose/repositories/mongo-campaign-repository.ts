// src/infra/db/mongoose/repositories/mongo-campaign-repository.ts
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
    lastDispatchedAt: doc.lastDispatchedAt || undefined,
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

    // janelas de start/end
    if (filters?.startAtGte) q["schedule.startAt"] = { ...(q["schedule.startAt"] || {}), $gte: filters.startAtGte }
    if (filters?.startAtLte) q["schedule.startAt"] = { ...(q["schedule.startAt"] || {}), $lte: filters.startAtLte }
    if (filters?.endAtGte) q["schedule.endAt"] = { ...(q["schedule.endAt"] || {}), $gte: filters.endAtGte }
    if (filters?.endAtLte) q["schedule.endAt"] = { ...(q["schedule.endAt"] || {}), $lte: filters.endAtLte }

    // activeAt: startAt <= X AND (endAt null OR endAt >= X)
    if (filters?.activeAt) {
      const X = filters.activeAt
      q["schedule.startAt"] = { ...(q["schedule.startAt"] || {}), $lte: X }
      q.$and = [
        ...(q.$and || []),
        {
          $or: [
            { "schedule.endAt": { $exists: false } },
            { "schedule.endAt": null },
            { "schedule.endAt": { $gte: X } },
          ]
        }
      ]
    }

    if (filters?.withInterval) {
      q["schedule.interval"] = { $exists: true, $ne: null }
    }
    if (filters?.withoutInterval) {
      q["schedule.interval"] = { $in: [null, undefined] }
    }

    if (filters?.lastDispatchedAtNull) {
      q.$and = [
        ...(q.$and || []),
        { $or: [{ lastDispatchedAt: { $exists: false } }, { lastDispatchedAt: null }] }
      ]
    }
    if (filters?.lastDispatchedAtBefore) {
      q.lastDispatchedAt = { ...(q.lastDispatchedAt || {}), $lt: filters.lastDispatchedAtBefore }
    }

    const skip = (page - 1) * size

    const [items, total] = await Promise.all([
      CampaignModel.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(size)
        .lean(),
      // ✅ conta com o mesmo filtro (antes estava sem q)
      CampaignModel.countDocuments(q)
    ])

    return {
      items: items.map(serialize),
      total,
      page,
      size,
      totalPages: Math.ceil(Math.max(total, 1) / size)
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
  },

  // grava o boundary se for “novo”
  async claimDispatchIfDue(id, boundaryAt) {
    const res = await CampaignModel.updateOne(
      {
        _id: id,
        $or: [
          { lastDispatchedAt: { $exists: false } },
          { lastDispatchedAt: null },
          { lastDispatchedAt: { $lt: boundaryAt } }
        ]
      },
      { $set: { lastDispatchedAt: boundaryAt } }
    )
    console.log(res, id, boundaryAt)
    return res.acknowledged === true && (res.modifiedCount ?? 0) > 0
  }
})
