import mongoose from 'mongoose'
import { randomUUID } from 'crypto'
import { tenantScope } from '../plugins/tenant-scope.js'
import { SubscriptionStatusEnum } from '../../../../domain/enums/subscription-status-enum.js'

const SubscriptionSchema = new mongoose.Schema({
  _id: { type: String, default: randomUUID },
  campaignId: { type: String, ref: 'Campaign', index: true, required: false },
  accountId: { type: String, ref: 'Account', index: true, required: true },
  status: {
    type: String,
    enum: SubscriptionStatusEnum,
    index: true,
    required: true,
  },
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  userAgent: String,
  locale: String,
  tags: [String],
  lastSeenAt: { type: Date },
}, { timestamps: { createdAt: true, updatedAt: false } }).plugin(tenantScope)

SubscriptionSchema.index({ accountId: 1, campaignId: 1, endpoint: 1 }, { unique: true })

export const SubscriptionModel = mongoose.model('Subscription', SubscriptionSchema)