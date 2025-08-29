// src/infra/crons/campaign-cron.ts
import cron from "node-cron"
import { MongoCampaignRepository } from "../db/mongoose/repositories/mongo-campaign-repository.js"
import { CampaignScheduleModeEnum } from "../../domain/enums/campaign-schedule-mode-enum.js"
import { CampaignStatusEnum } from "../../domain/enums/campaign-status-enum.js"
import { Campaign } from "../../domain/entities/campaign.js"
import { CampaignScheduleIntervalEnum } from "../../domain/enums/campaign-schedule-interval-enum.js"
import { dispatchCampaign } from "../../application/services/campaign-service.js"

const campaignRepository = MongoCampaignRepository()
const TIMEZONE = process.env.TZ || "UTC"

// Mapa do seu enum -> ms (ajuste se mudar os valores do enum)
const INTERVAL_MS: Record<CampaignScheduleIntervalEnum, number> = {
  FIVE_MINUTES: 5 * 60_000,
  TEN_MINUTES: 10 * 60_000,
  THIRTY_MINUTES: 30 * 60_000,
  ONE_HOUR: 60 * 60_000,
  THREE_HOURS: 3 * 60 * 60_000,
  SIX_HOURS: 6 * 60 * 60_000,
  ONE_DAY: 24 * 60 * 60_000,
  ONE_WEEK: 7 * 24 * 60 * 60_000,
}

// último boundary <= t
function floorBoundaryAtOrBefore(tMs: number, startMs: number, stepMs: number): number | null {
  if (tMs < startMs) return null
  const k = Math.floor((tMs - startMs) / stepMs)
  return startMs + k * stepMs
}

async function processOneTime(c: Campaign, nowMs: number) {
  const startMs = new Date(c.schedule.startAt).getTime()
  const endMs = c.schedule.endAt ? new Date(c.schedule.endAt).getTime() : undefined

  // já disparada
  if (c.lastDispatchedAt) return
  // ainda não chegou a hora
  if (nowMs < startMs) return
  // fora da janela
  if (endMs && startMs > endMs) return

  const boundaryAt = new Date(startMs)
  // marca atomicamente; só 1 instância vai conseguir
  const ok = await campaignRepository.claimDispatchIfDue(c.id, boundaryAt)
  if (!ok) return

  await dispatchCampaign(c.id, (c as any).accountId)
}

async function processRecurring(c: Campaign, nowMs: number) {
  const startMs = new Date(c.schedule.startAt).getTime()
  const endMs = c.schedule.endAt ? new Date(c.schedule.endAt).getTime() : undefined
  const intervalKey = c.schedule.interval as CampaignScheduleIntervalEnum | undefined
  if (!intervalKey) return

  const stepMs = INTERVAL_MS[intervalKey]
  if (!stepMs || stepMs <= 0) return
  if (nowMs < startMs) return

  // ► Estratégia “uma por tick” (sem catch-up infinito):
  //    - Se já houve disparo: próximo candidato = last + step
  //    - Se nunca houve: candidato = boundary mais recente (floor) até agora
  let candidateMs: number | null
  if (c.lastDispatchedAt) {
    const lastMs = new Date(c.lastDispatchedAt).getTime()
    candidateMs = lastMs + stepMs
  } else {
    candidateMs = floorBoundaryAtOrBefore(nowMs, startMs, stepMs)
  }

  if (candidateMs == null) return
  if (endMs && candidateMs > endMs) return
  if (candidateMs > nowMs) return // ainda não “bateu” o boundary

  const ok = await campaignRepository.claimDispatchIfDue(c.id, new Date(candidateMs))
  if (!ok) return

  await dispatchCampaign(c.id, (c as any).accountId)
}

async function tick() {
  const now = Date.now()
  let page = 1
  const size = 500

  while (true) {
    // Campanhas ativas agora: startAt <= now e (sem endAt ou endAt >= now)
    const { items } = await campaignRepository.listPaginated(page, size, {
      status: CampaignStatusEnum.PUBLISHED,
      startAtLte: new Date(now),
      activeAt: new Date(now),
    })
    if (!items.length) break

    for (const c of items) {
      if (c.schedule.mode === CampaignScheduleModeEnum.ONE_TIME) {
        await processOneTime(c, now)
      } else if (c.schedule.mode === CampaignScheduleModeEnum.RECURRING) {
        await processRecurring(c, now)
      }
    }

    if (items.length < size) break
    page++
  }
}

let _ticking = false

export function startCrons() {
  console.info("[crons] Iniciando...")

  cron.schedule(
    "* * * * *",
    async () => {
      if (_ticking) {
        console.warn("[crons] tick anterior ainda executando — pulando este minuto.")
        return
      }
      _ticking = true
      try {
        console.info("[crons] campaign:tick @", new Date().toISOString())
        await tick()
      } catch (err) {
        console.error("[crons] erro no tick:", err)
      } finally {
        _ticking = false
      }
    },
    { timezone: TIMEZONE }
  )
}
