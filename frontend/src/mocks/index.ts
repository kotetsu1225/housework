/**
 * モックデータのエクスポート
 *
 * @note バックエンドのGETエンドポイント実装後は削除予定
 */

export {
  MOCK_MEMBERS,
  MOCK_MEMBERS_WITH_STATS,
  getMockMemberById,
} from './members'
export type { MemberStats, MemberWithStats } from './members'

export {
  MOCK_TASK_DEFINITIONS,
  getMockTaskDefinitionById,
} from './taskDefinitions'

export {
  MOCK_TASK_EXECUTIONS,
  getMockTaskExecutionById,
  getMockTaskExecutionsByDate,
  getMockTaskExecutionsByStatus,
  getMockTaskExecutionsByMember,
  getMockTodayTaskSummary,
} from './taskExecutions'
