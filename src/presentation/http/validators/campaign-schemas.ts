import { z } from 'zod'
import { CampaignStatusEnum } from '../../../domain/enums/campaign-status-enum'
import { CampaignScheduleModeEnum } from '../../../domain/enums/campaign-schedule-mode-enum';
import { CampaignScheduleIntervalEnum } from '../../../domain/enums/campaign-schedule-interval-enum';

export const CampaignInput = z.object({
  status: z.nativeEnum(CampaignStatusEnum),
  title: z.string().min(1),
  icon: z.string().url(),
  body: z.string(),
  image: z.string().url().optional(),
  actions: z.array(z.object({ action: z.string().optional(), title: z.string(), url: z.string().url() })).max(3),
  target: z.object({ tags: z.array(z.string()) }),
  schedule: z.object({
    mode: z.nativeEnum(CampaignScheduleModeEnum),
    startAt: z.coerce.date(z.string()),
    interval: z.nativeEnum(CampaignScheduleIntervalEnum).optional(),
    endAt: z.coerce.date(z.string()).optional()
  })
})