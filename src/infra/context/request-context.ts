import { AsyncLocalStorage } from 'node:async_hooks'
export type RequestCtx = { accountId?: string }

const als = new AsyncLocalStorage<RequestCtx>()

export const runWithCtx = (ctx: RequestCtx, fn: () => void) => als.run(ctx, fn)

export const getCtx = () => als.getStore() ?? {}

export function getRequiredUser(): string {
  const { accountId } = getCtx()
  if (!accountId) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  return accountId
}