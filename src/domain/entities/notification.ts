import { NotificationStatusEnum } from "../enums/notification-status-enum"

export type Notification = {
  id: string
  accountId: string
  campaignId: string
  subscriptionId: string

  status: NotificationStatusEnum

  attemptCount: number
  errorCode?: string
  errorMessage?: string

  sentAt?: Date
  failedAt?: Date
  shownAt?: Date
  clickedAt?: Date
  closedAt?: Date
  clickedAction?: string

  createdAt?: Date
  updatedAt?: Date
}
