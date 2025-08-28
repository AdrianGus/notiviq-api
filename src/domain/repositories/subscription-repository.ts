import type { Subscription } from '../entities/subscription.js'

export type SubscriptionListFilters = {
  campaignId?: string
  tags?: string[]
  localeStartsWith?: string
  q?: string
}

export interface SubscriptionRepository {
  upsert(input: Omit<Subscription, 'id' | 'createdAt' | 'lastSeenAt'>): Promise<Subscription>
  update(id: string, patch: Partial<Subscription>): Promise<Subscription | null>
  listPaginated(page: number, size: number, filters?: SubscriptionListFilters): Promise<{
    items: Subscription[],
    total: number,
    page: number,
    size: number,
    totalPages: number
  }>
  findById(id: string): Promise<Subscription | null>
  removeByEndpoint(endpoint: string): Promise<void>
}