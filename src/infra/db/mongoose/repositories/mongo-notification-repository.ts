import { NotificationModel } from "../models/notification-model"
import type {
  NotificationRepository,
  NotificationListFilters,
  CreateForSendInput
} from "../../../../domain/repositories/notification-repository"
import type { Notification } from "../../../../domain/entities/notification"
import type { Paginated } from "../../../../domain/repositories/paginated-list-dto"

function serialize(d: any): Notification {
  return {
    id: String(d._id),
    accountId: String(d.accountId),
    campaignId: String(d.campaignId),
    subscriptionId: String(d.subscriptionId),
    status: d.status,
    attemptCount: d.attemptCount ?? 0,
    errorCode: d.errorCode ?? undefined,
    errorMessage: d.errorMessage ?? undefined,
    sentAt: d.sentAt ?? undefined,
    failedAt: d.failedAt ?? undefined,
    shownAt: d.shownAt ?? undefined,
    clickedAt: d.clickedAt ?? undefined,
    closedAt: d.closedAt ?? undefined,
    clickedAction: d.clickedAction ?? undefined,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

export const MongoNotificationRepository = (): NotificationRepository => ({
  async createForSend(input: CreateForSendInput) {
    const doc = await NotificationModel.create({
      accountId: String(input.accountId),
      campaignId: String(input.campaignId),
      subscriptionId: String(input.subscriptionId),
      status: "SENT",
      attemptCount: 1,
      sentAt: new Date(),
    })
    return { id: String(doc._id) }
  },

  async markFailed(id, code, message) {
    await NotificationModel.updateOne(
      { _id: String(id) },
      {
        $set: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: code,
          errorMessage: message,
        },
        $inc: { attemptCount: 1 },
      }
    )
  },

  async markShown(id, at) {
    await NotificationModel.updateOne(
      { _id: String(id) },
      { $set: { status: "SHOWN", shownAt: at || new Date() } }
    )
  },

  async markClicked(id, action, at) {
    await NotificationModel.updateOne(
      { _id: String(id) },
      { $set: { status: "CLICKED", clickedAt: at || new Date(), clickedAction: action } }
    )
  },

  async markClosed(id, at) {
    await NotificationModel.updateOne(
      { _id: String(id) },
      { $set: { status: "CLOSED", closedAt: at || new Date() } }
    )
  },

  async listPaginated(page: number, size: number, filters?: NotificationListFilters): Promise<Paginated<Notification>> {
    const q: any = {}

    if (filters?.subscriptionId) q.subscriptionId = String(filters.subscriptionId)
    if (filters?.campaignId) q.campaignId = String(filters.campaignId)
    if (filters?.status) {
      q.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status
    }
    if (filters?.createdFrom || filters?.createdTo) {
      q.createdAt = {}
      if (filters.createdFrom) q.createdAt.$gte = new Date(filters.createdFrom)
      if (filters.createdTo) q.createdAt.$lte = new Date(filters.createdTo)
    }

    const safePage = Math.max(1, Number(page) || 1)
    const safeSize = Math.max(1, Number(size) || 12)
    const skip = (safePage - 1) * safeSize

    const [total, docs] = await Promise.all([
      NotificationModel.countDocuments(q),
      NotificationModel.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeSize)
        .lean()
    ])

    const items = docs.map(serialize)
    const totalPages = Math.max(1, Math.ceil(total / safeSize))
    return { items, total, page: safePage, size: safeSize, totalPages }
  },
})
