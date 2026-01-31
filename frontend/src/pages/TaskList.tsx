/**
 * タスク一覧ページ（編集用）
 *
 * 全タスク定義の一覧表示・編集・削除機能を提供
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Filter, Calendar, Clock, Trash2, Edit2, RefreshCw, Star, Users, User } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { TaskEditModal } from '../components/tasks/TaskEditModal'
import { useTaskDefinition, useMembers } from '../hooks'
import { useAuth } from '../contexts/AuthContext'
import { formatTimeFromISO } from '../utils'
import type { TaskDefinition, TaskScope } from '../types'

/**
 * スコープバッジコンポーネント
 */
function ScopeBadge({ scope }: { scope: TaskScope }) {
  return scope === 'FAMILY' ? (
    <Badge variant="info" size="sm" className="whitespace-nowrap flex-shrink-0">
      <span className="flex items-center gap-1">
        <Users className="w-3 h-3" />
        家族
      </span>
    </Badge>
  ) : (
    <Badge variant="personal" size="sm" className="whitespace-nowrap flex-shrink-0">
      <span className="flex items-center gap-1">
        <User className="w-3 h-3" />
        個人
      </span>
    </Badge>
  )
}

/**
 * スケジュールバッジコンポーネント
 */
function ScheduleBadge({ task }: { task: TaskDefinition }) {
  if (task.scheduleType === 'ONE_TIME') {
    return <Badge variant="onetime" size="sm" className="whitespace-nowrap flex-shrink-0">単発</Badge>
  }
  const pattern = task.recurrence?.patternType
  switch (pattern) {
    case 'DAILY':
      return <Badge variant="recurring" size="sm" className="whitespace-nowrap flex-shrink-0">毎日</Badge>
    case 'WEEKLY':
      return <Badge variant="recurring" size="sm" className="whitespace-nowrap flex-shrink-0">毎週</Badge>
    case 'MONTHLY':
      return <Badge variant="recurring" size="sm" className="whitespace-nowrap flex-shrink-0">毎月</Badge>
    default:
      return null
  }
}

/**
 * タスクカードコンポーネント
 */
interface TaskCardProps {
  task: TaskDefinition
  onEdit: (task: TaskDefinition) => void
  onDelete: (task: TaskDefinition) => void
  canEdit: boolean
}

function TaskCard({ task, onEdit, onDelete, canEdit }: TaskCardProps) {
  return (
    <Card variant="glass" hoverable>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-white truncate">{task.name}</span>
            <ScopeBadge scope={task.scope} />
            <ScheduleBadge task={task} />
            {!canEdit && (
              <span className="text-xs text-white/30 whitespace-nowrap">
                他メンバーのタスク
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-white/50 line-clamp-1 mb-2">
              {task.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/40">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {formatTimeFromISO(task.scheduledTimeRange.startTime)} - {formatTimeFromISO(task.scheduledTimeRange.endTime)}
              </span>
            </div>
            {task.point > 0 && (
              <div className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{task.point}pt</span>
              </div>
            )}
            {task.recurrence && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {task.recurrence.patternType === 'DAILY' && '毎日'}
                  {task.recurrence.patternType === 'WEEKLY' && '毎週'}
                  {task.recurrence.patternType === 'MONTHLY' && '毎月'}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <>
              <button
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                onClick={() => onEdit(task)}
              >
                <Edit2 className="w-4 h-4 text-white/50 hover:text-white" />
              </button>
              <button
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                onClick={() => onDelete(task)}
              >
                <Trash2 className="w-4 h-4 text-white/50 hover:text-red-400" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 opacity-30">
              <Edit2 className="w-4 h-4 text-white/50" />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

/**
 * タスク一覧ページ
 */
export function TaskList() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterScope, setFilterScope] = useState<TaskScope | 'ALL'>('ALL')
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null)

  const { user } = useAuth()
  const { members, fetchMembers, loading: membersLoading } = useMembers()
  const {
    taskDefinitions,
    loading: taskLoading,
    error,
    fetchTaskDefinitions,
    editTaskDefinition,
    removeTaskDefinition,
    clearError,
  } = useTaskDefinition()

  const loading = membersLoading || taskLoading

  useEffect(() => {
    fetchMembers()
    fetchTaskDefinitions()
  }, [fetchMembers, fetchTaskDefinitions])

  // モーダル状態
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<TaskDefinition | null>(null)
  const [taskToEdit, setTaskToEdit] = useState<TaskDefinition | null>(null)

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  // フィルタリング
  const filteredTasks = taskDefinitions.filter((task) => {
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesScope = filterScope === 'ALL' || task.scope === filterScope
    const matchesMember = filterScope !== 'PERSONAL' || 
      filterMemberId === null || 
      task.ownerMemberId === filterMemberId
    
    return matchesSearch && matchesScope && matchesMember && !task.isDeleted
  })

  const handleFilterScopeChange = (scope: TaskScope | 'ALL') => {
    setFilterScope(scope)
    if (scope === 'PERSONAL') {
      setFilterMemberId(user?.id ?? null)
    } else {
      setFilterMemberId(null)
    }
  }

  const canEditTask = (task: TaskDefinition): boolean => {
    if (task.scope === 'FAMILY') return true
    return task.ownerMemberId === user?.id
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setTaskToEdit(null)
    clearError()
  }

  const handleDeleteClick = (task: TaskDefinition) => {
    setTaskToDelete(task)
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return

    const success = await removeTaskDefinition(taskToDelete.id)
    if (success) {
      setShowDeleteConfirm(false)
      setTaskToDelete(null)
    }
  }

  const handleEdit = (task: TaskDefinition) => {
    setTaskToEdit(task)
    setShowEditModal(true)
  }

  const handleSaveEdit = async (id: string, request: Parameters<typeof editTaskDefinition>[1]): Promise<boolean> => {
    const success = await editTaskDefinition(id, request)
    if (success) {
      handleCloseEditModal()
    }
    return success
  }

  const handleRefresh = async () => {
    await Promise.all([fetchMembers(), fetchTaskDefinitions()])
  }

  return (
    <>
      <Header
        title="タスク一覧"
        subtitle={`${filteredTasks.length}件の設定`}
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/tasks')}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              戻る
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />
      <PageContainer>
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* 検索とフィルター */}
        <section className="py-4 space-y-3">
          <Input
            placeholder="タスクを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant={filterScope === 'ALL' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleFilterScopeChange('ALL')}
            >
              すべて
            </Button>
            <Button
              variant={filterScope === 'FAMILY' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleFilterScopeChange('FAMILY')}
            >
              家族
            </Button>
            <Button
              variant={filterScope === 'PERSONAL' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleFilterScopeChange('PERSONAL')}
            >
              個人
            </Button>
          </div>

          {filterScope === 'PERSONAL' && members.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterMemberId === null ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilterMemberId(null)}
              >
                全員
              </Button>
              {members.map((member) => (
                <Button
                  key={member.id}
                  variant={filterMemberId === member.id ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFilterMemberId(member.id)}
                >
                  {member.id === user?.id ? '自分' : member.name}
                </Button>
              ))}
            </div>
          )}
        </section>

        {/* タスク一覧 */}
        <section>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                canEdit={canEditTask(task)}
              />
            ))}
          </div>

          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <Filter className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">タスク設定が見つかりません</p>
            </div>
          )}
        </section>

        {/* 削除確認モーダル */}
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false)
            setTaskToDelete(null)
          }}
          title="タスクの削除"
          footer={
            <>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setTaskToDelete(null)
                }}
                disabled={loading}
              >
                キャンセル
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleConfirmDelete}
                loading={loading}
              >
                削除
              </Button>
            </>
          }
        >
          <p className="text-white/70">
            「{taskToDelete?.name}」を削除しますか？この操作は取り消せません。
          </p>
        </Modal>

        {/* 編集モーダル */}
        <TaskEditModal
          isOpen={showEditModal}
          onClose={handleCloseEditModal}
          task={taskToEdit}
          onSave={handleSaveEdit}
          loading={loading}
          error={error}
          currentUserId={user?.id}
        />
      </PageContainer>
    </>
  )
}
