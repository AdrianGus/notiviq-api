import { Router } from "express"
import { NotificationController } from "../controllers/notification-controller"
import { tenantContextMiddleware } from "../middlwares/tenant-context-middleware"

export const notificationRouter = Router()

notificationRouter.get("/", tenantContextMiddleware, NotificationController.list)
notificationRouter.post("/:id/shown", NotificationController.markShown)
notificationRouter.post("/:id/click", NotificationController.markClicked)
notificationRouter.post("/:id/close", NotificationController.markClosed)