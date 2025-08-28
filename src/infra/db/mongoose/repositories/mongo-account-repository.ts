import { Account } from "../../../../domain/entities/account"
import { AccountRepository } from "../../../../domain/repositories/account-repository"
import { AccountModel } from "../models/account-model"

function serialize(doc: any): Account {
  return {
    id: String(doc._id),
    externalId: doc.externalId,
    provider: doc.provider,
    email: doc.email ?? undefined,
    name: doc.name ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  }
}

export const MongoAccountRepository = (): AccountRepository => ({
  async findByExternalId(provider, externalId) {
    const doc = await AccountModel.findOne({ provider, externalId }).lean()
    return doc ? serialize(doc) : null
  },

  async create(data) {
    const doc = await AccountModel.create(data)
    return serialize(doc)
  }
})