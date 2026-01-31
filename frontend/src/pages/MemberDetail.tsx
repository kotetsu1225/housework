/**
 * メンバー詳細ページ
 *
 * 個別メンバーの詳細情報・今日の活動・完了タスク一覧を表示
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, CheckCircle2, Users, User, Star, Clock, History } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { Alert } from '../components/ui/Alert'
import { Modal } from '../components/ui/Modal'
import { CompletedTaskCard } from '../components/dashboard'
import { useMembers, useCompletedTasks } from '../hooks'
import { isParentRole, formatTimeFromISO, toISODateString } from '../utils'
import { getRoleLabel } from '../constants'
import { getRankingMedal, calculateMemberRank } from './Members'
import type { CompletedTaskDto } from '../api/completedTasks'
import type { Member } from '../types'

type FilterTab = 'all' | 'family' | 'personal'

/**
 * タスク詳細モーダルコンポーネント
 */
interface TaskDetailModalProps {
  task: CompletedTaskDto | null
  isOpen: boolean
  onClose: () => void
  members: Member[]
}

function TaskDetailModal({ task, isOpen, onClose, members }: TaskDetailModalProps) {
  if (!task) return null

  // 担当者情報にroleを追加
  const assigneesWithRole = task.assigneeMembers.map((assignee) => {
    const memberInfo = members.find((m) => m.id === assignee.id)
    return {
      ...assignee,
      role: memberInfo?.role,
    }
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task.name}
      footer={
        <Button variant="secondary" onClick={onClose} className="flex-1">
          閉じる
        </Button>
      }
    >
      <div className="space-y-4">
        {/* メタ情報 */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
          <Badge
            variant={task.scheduleType === 'ONE_TIME' ? 'onetime' : 'recurring'}
            size="sm"
          >
            {task.scheduleType === 'ONE_TIME' ? '単発' : '定期'}
          </Badge>
          <Badge
            variant={task.scope === 'FAMILY' ? 'info' : 'personal'}
            size="sm"
          >
            {task.scope === 'FAMILY' ? '家族' : '個人'}
          </Badge>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatTimeFromISO(task.scheduledStartTime)} - {formatTimeFromISO(task.scheduledEndTime)}
          </span>
          {task.frozenPoint > 0 && (
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Star className="w-4 h-4 fill-amber-400" />
              +{task.frozenPoint}pt
            </span>
          )}
        </div>

        {/* 説明文 */}
        {task.description && (
          <div>
            <p className="text-sm text-white/50 mb-1">説明</p>
            <p className="text-white/80 text-sm bg-dark-800/50 rounded-lg p-3">
              {task.description}
            </p>
          </div>
        )}

        {/* 担当者 */}
        {assigneesWithRole.length > 0 && (
          <div>
            <p className="text-sm text-white/50 mb-2">担当者</p>
            <div className="flex flex-wrap gap-2">
              {assigneesWithRole.map((assignee) => (
                <div
                  key={assignee.id}
                  className="flex items-center gap-2 bg-dark-800/50 px-3 py-1.5 rounded-full"
                >
                  <Avatar
                    name={assignee.name}
                    size="sm"
                    role={assignee.role}
                    variant={assignee.role && isParentRole(assignee.role) ? 'parent' : 'child'}
                  />
                  <span className="text-white text-sm">{assignee.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/**
 * メンバー詳細ページ
 */
export function MemberDetail() {
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()

  const today = new Date()
  const todayStr = toISODateString(today)

  // メンバー一覧取得
  const { members, fetchMembers, loading: membersLoading, error: membersError } = useMembers()

  // このメンバーの今日の完了タスクを取得
  const {
    completedTasks,
    loading: tasksLoading,
    error: tasksError,
    fetchCompletedTasks,
  } = useCompletedTasks()

  // フィルタータブ
  const [filterTab, setFilterTab] = useState<FilterTab>('all')

  // タスク詳細モーダル
  const [selectedTask, setSelectedTask] = useState<CompletedTaskDto | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)

  const handleTaskClick = (task: CompletedTaskDto) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }

  const handleCloseModal = () => {
    setShowTaskModal(false)
    setSelectedTask(null)
  }

  // 初回マウント時にデータを取得
  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  // memberIdが確定したら完了タスクを取得
  useEffect(() => {
    if (memberId) {
      fetchCompletedTasks({
        memberIds: [memberId],
        date: todayStr,
      })
    }
  }, [memberId, todayStr, fetchCompletedTasks])

  // 現在のメンバーを取得
  const member = useMemo(() => {
    return members.find((m) => m.id === memberId)
  }, [members, memberId])

  // フィルタリングされた完了タスク
  const filteredTasks = useMemo(() => {
    switch (filterTab) {
      case 'family':
        return completedTasks.filter((task) => task.scope === 'FAMILY')
      case 'personal':
        return completedTasks.filter((task) => task.scope === 'PERSONAL')
      default:
        return completedTasks
    }
  }, [completedTasks, filterTab])

  // 完了数の集計
  const familyCompleted = completedTasks.filter((t) => t.scope === 'FAMILY').length
  const personalCompleted = completedTasks.filter((t) => t.scope === 'PERSONAL').length

  // 今日のサマリー（メンバー統計を優先）
  const todayEarnedPoints = member?.todayEarnedPoint ?? 0
  const todayFamilyCompleted = member?.todayFamilyTaskCompleted ?? familyCompleted
  const todayPersonalCompleted = member?.todayPersonalTaskCompleted ?? personalCompleted
  const todayCompletedCount = member
    ? todayFamilyCompleted + todayPersonalCompleted
    : completedTasks.length

  // ランキング計算（ポイント順）
  const currentRank = useMemo(() => {
    return calculateMemberRank(members, memberId)
  }, [members, memberId])

  const loading = membersLoading || tasksLoading
  const error = membersError || tasksError

  if (loading && !member) {
    return (
      <>
        <Header title="メンバー詳細" />
        <PageContainer>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-coral-500" />
          </div>
        </PageContainer>
      </>
    )
  }

  if (!member) {
    return (
      <>
        <Header title="メンバー詳細" />
        <PageContainer>
          <Alert variant="error">メンバーが見つかりませんでした</Alert>
          <Button variant="secondary" onClick={() => navigate('/members')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
        </PageContainer>
      </>
    )
  }

  return (
    <>
      <Header
        title={member.name}
        subtitle={getRoleLabel(member.role)}
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate('/members')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            戻る
          </Button>
        }
      />
      <PageContainer>
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* プロフィールカード */}
        <Card variant="glass" className="mb-6">
          <div className="flex items-center gap-4">
            <Avatar
              name={member.name}
              size="xl"
              role={member.role}
              variant={isParentRole(member.role) ? 'parent' : 'child'}
            />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-1">{member.name}</h2>
              <p className="text-white/50">{getRoleLabel(member.role)}</p>
            </div>
          </div>
        </Card>

        {/* 今日のサマリー */}
        <section className="mb-6">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            今日の成果
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {/* 獲得ポイント */}
            <Card variant="glass" className="p-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                  <Star className="w-5 h-5 fill-amber-400" />
                </div>
                <p className="text-2xl font-bold text-white">{todayEarnedPoints}</p>
                <p className="text-xs text-white/50">今日の獲得pt</p>
              </div>
            </Card>
            {/* 完了数 */}
            <Card variant="glass" className="p-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-white">{todayCompletedCount}</p>
                <p className="text-xs text-white/50">今日の完了タスク</p>
              </div>
            </Card>
            {/* ランキング */}
            <Card variant="glass" className="p-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                  <Trophy className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {currentRank !== null ? getRankingMedal(currentRank) : '-'}
                </p>
                <p className="text-xs text-white/50">現在のランキング</p>
              </div>
            </Card>
          </div>
        </section>

        {/* 完了数内訳 */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-white/70 mb-2">完了数内訳</h3>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-white/70">家族タスク:</span>
              <span className="text-white font-bold">{todayFamilyCompleted}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" />
              <span className="text-white/70">個人タスク:</span>
              <span className="text-white font-bold">{todayPersonalCompleted}</span>
            </div>
          </div>
        </section>

        {/* 完了タスク一覧 */}
        <section>
          <h3 className="text-lg font-bold text-white mb-3">今日完了したタスク</h3>

          {/* フィルタータブ */}
          <div className="flex gap-2 mb-4">
            {(['all', 'family', 'personal'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterTab === tab
                    ? 'bg-coral-500/20 text-coral-400 border border-coral-500/30'
                    : 'bg-dark-800/50 text-white/50 border border-transparent hover:border-dark-600'
                }`}
              >
                {tab === 'all' ? 'すべて' : tab === 'family' ? '家族' : '個人'}
                <span className="ml-1 text-xs">
                  ({tab === 'all'
                    ? completedTasks.length
                    : tab === 'family'
                    ? familyCompleted
                    : personalCompleted})
                </span>
              </button>
            ))}
          </div>

          {/* タスクリスト */}
          {filteredTasks.length > 0 ? (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <CompletedTaskCard key={task.taskExecutionId} task={task} onClick={handleTaskClick} members={members} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-white/50">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>完了したタスクはありません</p>
            </div>
          )}
        </section>

        {/* 完了履歴を見るボタン（ページ最下部） */}
        <section className="mt-6">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => navigate(`/members/${memberId}/completed`)}
          >
            <History className="w-4 h-4 mr-2" />
            完了履歴を見る
          </Button>
        </section>

        {/* タスク詳細モーダル */}
        <TaskDetailModal
          task={selectedTask}
          isOpen={showTaskModal}
          onClose={handleCloseModal}
          members={members}
        />
      </PageContainer>
    </>
  )
}
