import mongoose from "mongoose"
import { randomUUID } from "crypto"
import { tenantScope } from "../plugins/tenant-scope.js"

const ScheduleCursorSchema = new mongoose.Schema({
  _id: { type: String, default: randomUUID },
  accountId: { type: String, index: true, required: true },
  campaignId: { type: String, index: true, required: true, unique: true },
  lastTickAt: { type: Date }
}, { timestamps: true }).plugin(tenantScope)

ScheduleCursorSchema.index({ accountId: 1, campaignId: 1 }, { unique: true })

export const ScheduleCursorModel = mongoose.model("ScheduleCursor", ScheduleCursorSchema)
