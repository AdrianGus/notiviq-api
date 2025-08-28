import mongoose from "mongoose"
import { randomUUID } from "crypto"
import { tenantScope } from "../plugins/tenant-scope.js"
import { NotificationStatusEnum } from "../../../../domain/enums/notification-status-enum.js"

const NotificationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: randomUUID },

    accountId: { type: String, ref: "Account", index: true, required: true },
    campaignId: { type: String, ref: "Campaign", index: true, required: true },
    subscriptionId: { type: String, ref: "Subscription", index: true, required: true },

    status: {
      type: String,
      enum: NotificationStatusEnum,
      index: true,
      required: true,
    },

    attemptCount: { type: Number, default: 0 },
    errorCode: { type: String },
    errorMessage: { type: String },

    sentAt: { type: Date },
    failedAt: { type: Date },
    shownAt: { type: Date },
    clickedAt: { type: Date },
    closedAt: { type: Date },
    clickedAction: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
  }
).plugin(tenantScope)

NotificationSchema.index({ accountId: 1, campaignId: 1, createdAt: -1 })
NotificationSchema.index({ subscriptionId: 1, createdAt: -1 })
NotificationSchema.index({ status: 1, updatedAt: -1 })

export const NotificationModel = mongoose.model("Notification", NotificationSchema)