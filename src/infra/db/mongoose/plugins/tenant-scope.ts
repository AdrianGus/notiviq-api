import type { Schema } from 'mongoose'
import { getCtx } from '../../../context/request-context.js'

export function tenantScope(schema: Schema) {
  const applyAccountId = function (this: any) {
    const { accountId } = getCtx()
    if (accountId && !this.accountId) {
      this.accountId = accountId
    }
  }

  schema.pre('validate', function (next) {
    applyAccountId.call(this)
    next()
  })

  schema.pre('save', function (next) {
    applyAccountId.call(this)
    next()
  })

  const guard = function (this: any, next: any) {
    const { accountId } = getCtx()
    if (accountId && !this.getFilter()?.accountId) {
      this.where({ accountId })
    }
    next()
  }

  schema.pre('find', guard)
  schema.pre('findOne', guard)
  schema.pre('findOneAndUpdate', guard)
  schema.pre('findOneAndDelete', guard)
  schema.pre('deleteOne', guard)
  schema.pre('deleteMany', guard)
}