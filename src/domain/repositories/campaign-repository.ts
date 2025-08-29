// src/domain/repositories/campaign-repository.ts
import type { Campaign } from '../entities/campaign.js'
import { CampaignScheduleModeEnum } from '../enums/campaign-schedule-mode-enum.js'
import { CampaignStatusEnum } from '../enums/campaign-status-enum.js'

export type CampaignListFilters = {
  status?: CampaignStatusEnum
  mode?: CampaignScheduleModeEnum
  q?: string

  // janelas de agenda
  startAtGte?: Date
  startAtLte?: Date
  endAtGte?: Date
  endAtLte?: Date

  // conveniência pro cron: ativas em uma data
  activeAt?: Date // startAt <= activeAt AND (endAt null OR endAt >= activeAt)

  // presença de intervalo (recorrentes)
  withInterval?: boolean
  withoutInterval?: boolean

  // controle de última execução
  lastDispatchedAtNull?: boolean
  lastDispatchedAtBefore?: Date
}

export interface CampaignRepository {
  create(input: Omit<Campaign, 'id' | 'accountId' | 'createdAt' | 'updatedAt' | 'status'> & { status?: Campaign['status'] }): Promise<Campaign>
  list(): Promise<Campaign[]>
  listPaginated(page: number, size: number, filters?: CampaignListFilters): Promise<{
    items: Campaign[],
    total: number,
    page: number,
    size: number,
    totalPages: number
  }>
  findById(id: string): Promise<Campaign | null>
  update(id: string, patch: Partial<Campaign>): Promise<Campaign | null>
  delete(id: string): Promise<void>

  /**
   * Marca a campanha como disparada em "boundaryAt" apenas se:
   * - lastDispatchedAt estiver ausente OU menor que boundaryAt.
   * Retorna true se conseguiu marcar (ou seja, você deve disparar), false caso já tenha sido marcado por outra execução.
   */
  claimDispatchIfDue(id: string, boundaryAt: Date): Promise<boolean>
}
