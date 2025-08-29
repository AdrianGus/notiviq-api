import { Router } from 'express'
import { tenantContextMiddleware } from '../middlwares/tenant-context-middleware.js'
import { AccountController } from '../controllers/account-controller.js'

export const accountsRouter = Router()

accountsRouter.use(tenantContextMiddleware)
accountsRouter.get('/', AccountController.getByContext)
accountsRouter.patch('/', AccountController.updateByContext)
