export interface Account {
  id: string
  externalId: string
  provider: string
  email?: string
  name?: string
  createdAt: Date
  updatedAt: Date
}