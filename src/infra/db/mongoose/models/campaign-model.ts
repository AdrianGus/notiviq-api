import mongoose from 'mongoose'
import { randomUUID } from 'crypto'
import { tenantScope } from '../plugins/tenant-scope.js'
import { CampaignStatusEnum } from '../../../../domain/enums/campaign-status-enum.js'
import { CampaignScheduleModeEnum } from '../../../../domain/enums/campaign-schedule-mode-enum.js'
import { CampaignScheduleIntervalEnum } from '../../../../domain/enums/campaign-schedule-interval-enum.js'

const ActionSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
)

const ScheduleSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: Object.values(CampaignScheduleModeEnum),
      required: true,
    },
    startAt: { type: Date, required: true },
    interval: {
      type: String,
      enum: Object.values(CampaignScheduleIntervalEnum),
      required: false,
    },
    endAt: { type: Date, required: false },
  },
  { _id: false }
)

const CampaignSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    accountId: { type: String, index: true, required: true },

    status: {
      type: String,
      enum: Object.values(CampaignStatusEnum),
      default: CampaignStatusEnum.DRAFT,
    },

    title: { type: String, required: true, trim: true },
    icon: { type: String, required: true },
    body: { type: String, required: true },
    image: { type: String, required: false },

    actions: { type: [ActionSchema], default: [] },

    target: {
      tags: { type: [String], default: [] },
    },

    schedule: { type: ScheduleSchema, required: true },
  },
  { timestamps: true }
)

CampaignSchema.plugin(tenantScope)

export const CampaignModel = mongoose.model('Campaign', CampaignSchema)