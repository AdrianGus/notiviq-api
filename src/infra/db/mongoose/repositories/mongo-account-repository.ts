import { Account } from "../../../../domain/entities/account.js"
import { AccountRepository } from "../../../../domain/repositories/account-repository.js"
import { AccountModel } from "../models/account-model.js"

function serialize(doc: any): Account {
  return {
    id: String(doc._id),
    externalId: doc.externalId,
    provider: doc.provider,
    email: doc.email ?? undefined,
    name: doc.name ?? undefined,
    settings: doc.settings ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export const MongoAccountRepository = (): AccountRepository & {
  update: (id: string, data: Partial<Account>) => Promise<Account | null>
} => ({
  async findByExternalId(provider, externalId) {
    const doc = await AccountModel.findOne({ provider, externalId }).lean()
    return doc ? serialize(doc) : null
  },

  async create(data) {
    const doc = await AccountModel.create(data)
    return serialize(doc)
  },

  async update(id, data) {
    const doc = await AccountModel.findByIdAndUpdate(id, data, {
      new: true,
    }).lean()
    return doc ? serialize(doc) : null
  },
})
