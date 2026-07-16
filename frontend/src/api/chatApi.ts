import { modelSourceApi } from '@/api/modelSourceApi';
import { sessionApi } from '@/api/sessionApi';

export const chatApi = {
  ...sessionApi,
  ...modelSourceApi,
};
