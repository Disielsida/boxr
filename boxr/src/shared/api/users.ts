import { request } from './client';

import type { JudgeInfo } from '../types';

export const usersApi = {
  listJudges: () => request<JudgeInfo[]>('/users/judges'),
};
