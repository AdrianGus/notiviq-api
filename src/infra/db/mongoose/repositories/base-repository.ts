import type { Model, FilterQuery } from 'mongoose'

export function createRepository<T>(opts: {
  Model: Model<any>
  serialize: (doc: any) => T
}) {
  const { Model, serialize } = opts

  return {
    async create(input: any): Promise<T> {
      const doc = new Model(input)
      await doc.save()
      return serialize(doc)
    },

    async list(): Promise<T[]> {
      const docs = await Model.find().sort({ createdAt: -1 }).lean()
      return docs.map(serialize)
    },

    async findById(id: string): Promise<T | null> {
      const doc = await Model.findById(id).lean()
      return doc ? serialize(doc) : null
    },

    async update(id: string, patch: any): Promise<T | null> {
      const doc = await Model.findByIdAndUpdate(id, patch, { new: true }).lean()
      return doc ? serialize(doc) : null
    },

    async delete(id: string): Promise<void> {
      await Model.findByIdAndDelete(id)
    },

    async upsert(filter: FilterQuery<any>, data: any, onInsert?: Record<string, any>): Promise<T> {
      const update = { $set: data, ...(onInsert ? { $setOnInsert: onInsert } : {}) }
      const doc = await Model.findOneAndUpdate(filter, update, { new: true, upsert: true }).lean()
      return serialize(doc)
    }
  }
}

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}