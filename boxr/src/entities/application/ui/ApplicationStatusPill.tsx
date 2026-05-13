import { Pill } from '@/shared/ui';

import { STATUS_LABEL, STATUS_VARIANT } from '../model/types';

import type { ApplicationStatus } from '@/shared/types';

interface Props {
  status: ApplicationStatus;
}

export const ApplicationStatusPill = ({ status }: Props) => (
  <Pill variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Pill>
);
