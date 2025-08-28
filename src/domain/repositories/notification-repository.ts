import { Paginated } from "./paginated-list-dto"
import { Notification } from "../entities/notification"
import { NotificationStatusEnum } from "../enums/notification-status-enum"

export type CreateForSendInput = {
  accountId: string
  campaignId: string
  subscriptionId: string
}

export type NotificationListFilters = {
  subscriptionId?: string
  campaignId?: string
  status?: NotificationStatusEnum | NotificationStatusEnum[]
  createdFrom?: Date
  createdTo?: Date
}

export interface NotificationRepository {
  /** Cria um registro já como SENT (tentativa de envio realizada) e retorna o id para ser enviado no payload */
  createForSend(input: CreateForSendInput): Promise<{ id: string }>

  /** Se o push falhar após a criação, marca como FAILED e registra erro */
  markFailed(id: string, code?: string, message?: string): Promise<void>

  /** Eventos reportados pelo Service Worker */
  markShown(id: string, at?: Date): Promise<void>
  markClicked(id: string, action?: string, at?: Date): Promise<void>
  markClosed(id: string, at?: Date): Promise<void>

  /** Lista paginada para relatórios (ex.: por subscription no painel) */
  listPaginated(page: number, size: number, filters?: NotificationListFilters): Promise<Paginated<Notification>>
}
