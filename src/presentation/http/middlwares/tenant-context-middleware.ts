import { getAuth, clerkClient } from '@clerk/express'
import { randomUUID } from 'crypto'
import { runWithCtx } from '../../../infra/context/request-context.js'
import { MongoAccountRepository } from '../../../infra/db/mongoose/repositories/mongo-account-repository.js'
import type { RequestHandler } from 'express'

const accountRepo = MongoAccountRepository()

export const tenantContextMiddleware: RequestHandler = async (req, res, next) => {
  const { userId } = getAuth(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let account = await accountRepo.findByExternalId('clerk', userId)
  if (!account) {
    const clerkUser = await clerkClient.users.getUser(userId)

    account = await accountRepo.create({
      id: randomUUID(),
      externalId: userId,
      provider: 'clerk',
      email: clerkUser.emailAddresses[0]?.emailAddress,
      name: clerkUser.firstName ?? ''
    } as any)
  }

  req.tenant = { accountId: account.id }

  runWithCtx({ accountId: account.id }, next)
}