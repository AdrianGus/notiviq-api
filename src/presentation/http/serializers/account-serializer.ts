import { Account } from "../../../domain/entities/account.js"

export function publicAccountSerializer(account: Account) {
  return {
    settings: account.settings ?? {},
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    name: account.name ?? null,
  }
}