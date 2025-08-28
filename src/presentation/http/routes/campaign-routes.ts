import { Router } from 'express'
import { CampaignController } from '../controllers/campaign-controller.js'
import { tenantContextMiddleware } from '../middlwares/tenant-context-middleware.js'

export const campaignsRouter = Router()

campaignsRouter.use(tenantContextMiddleware)
campaignsRouter.get('/', CampaignController.list)
campaignsRouter.post('/', CampaignController.create)
campaignsRouter.get('/:id', CampaignController.get)
campaignsRouter.patch('/:id', CampaignController.update)
campaignsRouter.delete('/:id', CampaignController.remove)
campaignsRouter.post('/:id/notify-test', CampaignController.notifyTest)
