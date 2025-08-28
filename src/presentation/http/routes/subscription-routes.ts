import { Router } from 'express'
import { SubscriptionController } from '../controllers/subscription-controller'
import { tenantContextMiddleware } from '../middlwares/tenant-context-middleware'

export const subscriptionsRouter = Router()

subscriptionsRouter.post('/', SubscriptionController.subscribe)

subscriptionsRouter.use(tenantContextMiddleware)
subscriptionsRouter.get('/', SubscriptionController.list)
subscriptionsRouter.get('/:id', SubscriptionController.get)
subscriptionsRouter.patch('/:id', SubscriptionController.update)
