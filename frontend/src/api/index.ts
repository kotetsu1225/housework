/**
 * API層のエクスポート
 */

// クライアント
export {
  apiClient,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  ApiError,
  TOKEN_STORAGE_KEY,
  getStoredToken,
  setStoredToken,
  removeStoredToken,
} from './client'

// Auth API
export { loginApi, registerApi } from './auth'

// Member API
export { getMembers, getMember, createMember, updateMember } from './members'

// TaskDefinition API
export {
  getTaskDefinitions,
  getTaskDefinition,
  createTaskDefinition,
  updateTaskDefinition,
  deleteTaskDefinition,
} from './taskDefinitions'

// TaskExecution API
export {
  getTaskExecutions,
  getTaskExecution,
  startTaskExecution,
  completeTaskExecution,
  cancelTaskExecution,
  assignTaskExecution,
  generateTaskExecutions,
  generateTodayTaskExecutions,
} from './taskExecutions'
export type { GetTaskExecutionsOptions } from './taskExecutions'

// Dashboard API (CQRS Query)
export { getDashboardData } from './dashboard'
export type {
  DashboardResponse,
  TodayTaskDto,
  MemberTaskDto,
  MemberTaskSummaryDto,
} from './dashboard'
