import type { Campaign } from '../entities/campaign.js'
import { CampaignScheduleModeEnum } from '../enums/campaign-schedule-mode-enum.js'
import { CampaignStatusEnum } from '../enums/campaign-status-enum.js'

export type CampaignListFilters = {
  status?: CampaignStatusEnum
  mode?: CampaignScheduleModeEnum
  q?: string
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
}