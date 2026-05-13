import type { Application, ApplicationStatus } from '@/shared/types';

export type { Application, ApplicationStatus };

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: 'На проверке',
  approved: 'Одобрена',
  rejected: 'Отклонена',
  withdrawn: 'Отозвана',
};

export const STATUS_VARIANT: Record<ApplicationStatus, 'pending' | 'active' | 'danger' | 'default'> = {
  pending: 'pending',
  approved: 'active',
  rejected: 'danger',
  withdrawn: 'default',
};
