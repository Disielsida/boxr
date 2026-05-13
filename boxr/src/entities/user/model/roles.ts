import type { UserRole } from '@/shared/types';

export interface RoleOption {
  id: UserRole;
  label: string;
  desc: string;
}

export const ROLES: RoleOption[] = [
  { id: 'organizer', label: 'Организатор', desc: 'Создание и управление турнирами' },
  { id: 'trainer',   label: 'Тренер',      desc: 'Регистрация боксёров, просмотр расписания' },
  { id: 'judge',     label: 'Судья',       desc: 'Судейство и ведение протоколов' },
];
