export type Settings = {
  domain: string
}

export interface Account {
  id: string
  externalId: string
  provider: string
  email?: string
  name?: string
  settings?: Settings
  createdAt: Date
  updatedAt: Date
}