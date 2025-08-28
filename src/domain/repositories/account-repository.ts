import { Account } from "../entities/account.js"

export interface AccountRepository {
  findByExternalId(provider: string, externalId: string): Promise<Account | null>
  create(data: Omit<Account, "createdAt" | "updatedAt">): Promise<Account>
}