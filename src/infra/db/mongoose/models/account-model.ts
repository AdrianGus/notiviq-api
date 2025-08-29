import mongoose from 'mongoose'
import { randomUUID } from 'crypto'

const SettingsSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, trim: true }
  },
  { _id: false }
)

const AccountSchema = new mongoose.Schema({
  _id: { type: String, default: randomUUID },
  externalId: { type: String, required: true, index: true, unique: true },
  provider: { type: String, required: true, default: 'clerk' },
  email: { type: String, index: true },
  name: String,
  settings: { type: SettingsSchema, required: false }
}, { timestamps: true })

export const AccountModel = mongoose.model('Account', AccountSchema)