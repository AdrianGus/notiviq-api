import { CampaignScheduleIntervalEnum } from "../enums/campaign-schedule-interval-enum";
import { CampaignScheduleModeEnum } from "../enums/campaign-schedule-mode-enum";
import { CampaignStatusEnum } from "../enums/campaign-status-enum";

export type NotificationAction = {
  action: string;   // slug gerado do título
  title: string;
  url: string;
};

export type CampaignTarget = {
  tags?: string[];
};

export type CampaignSchedule = {
  mode: CampaignScheduleModeEnum;
  startAt: Date;
  interval?: CampaignScheduleIntervalEnum;
  endAt?: Date;
};

export type Campaign = {
  id: string;
  accountId: string;

  status: CampaignStatusEnum;

  title: string;
  icon: string;
  body: string;
  image?: string;

  actions: NotificationAction[];
  target: CampaignTarget;

  schedule: CampaignSchedule;

  createdAt: Date;
  updatedAt: Date;
};