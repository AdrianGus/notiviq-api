import cron from "node-cron"
import { MongoCampaignRepository } from "../db/mongoose/repositories/mongo-campaign-repository.js"
import { CampaignScheduleModeEnum } from "../../domain/enums/campaign-schedule-mode-enum.js"
import { CampaignStatusEnum } from "../../domain/enums/campaign-status-enum.js"
import { dispatchCampaign } from "../../application/services/campaign-service.js"

const campaignRepository = MongoCampaignRepository()

const INTERVAL_MS: Record<string, number> = {
  FIVE_MINUTES: 5 * 60_000,
  TEN_MINUTES: 10 * 60_000,
  THIRTY_MINUTES: 30 * 60_000,
  ONE_HOUR: 60 * 60_000,
  THREE_HOURS: 3 * 60 * 60_000,
  SIX_HOURS: 6 * 60 * 60_000,
  ONE_DAY: 24 * 60 * 60_000,
  TWO_DAYS: 2 * 24 * 60 * 60_000,
  ONE_WEEK: 7 * 24 * 60 * 60_000,
}

function floorToBoundary(now: number, startAt: number, stepMs: number) {
  if (now < startAt) return null

  const k = Math.floor((now - startAt) / stepMs)

  return new Date(startAt + k * stepMs)
}

async function tickCampaigns() {
  const now = new Date()
  const nowMs = now.getTime()

  let page = 1
  const pageSize = 500

  while (true) {
    const result = await campaignRepository.listPaginated(page, pageSize, { status: CampaignStatusEnum.PUBLISHED })

    const campaigns = result.items

    if (!campaigns.length) break

    for (const campaign of campaigns) {
      const mode = campaign.schedule.mode
      const startAt = campaign.schedule.startAt
      const endAt = campaign.schedule.endAt
      const intervalKey: string | undefined = campaign?.schedule?.interval

      if (!mode || !startAt) continue

      const startMs = new Date(startAt as any).getTime()
      const endMs = endAt ? new Date(endAt as any).getTime() : undefined

      let boundary: Date | null = null

      if (mode == CampaignScheduleModeEnum.ONE_TIME) {
        boundary = nowMs >= startMs ? new Date(startMs) : null
      } else if (mode === CampaignScheduleModeEnum.RECURRING && intervalKey && INTERVAL_MS[intervalKey]) {
        boundary = floorToBoundary(nowMs, startMs, INTERVAL_MS[intervalKey])
      }

      if (!boundary) continue

      if (endMs && boundary.getTime() > endMs) continue

      await dispatchCampaign(campaign.id, (campaign as any).accountId)
    }

    if (campaigns.length < pageSize) break

    page += 1
  }
}

export async function startCrons() {
  console.info("[crons] Iniciando...")

  cron.schedule("* * * * *", async () => {
    console.info("[crons] campaign:tick running...")

    await tickCampaigns()
  })
}
