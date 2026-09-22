/**
 * タスク一覧ページ（編集用）
 *
 * 全タスク定義の一覧表示・編集・削除機能を提供
 */

import { useState, useEffect } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { SectionBox } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { Segmented } from '../components/ui/Segmented'
import { TaskEditModal } from '../components/tasks/TaskEditModal'
import { TaskDefinitionCard } from '../components/tasks/TaskDefinitionCard'
import { useTaskDefinition, useMembers } from '../hooks'
import { useAuth } from '../contexts/AuthContext'
import type { TaskDefinition, TaskScope } from '../types'

/**
 * タスク一覧ページ
 */
export function TaskList() {
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

  const familyTasks = filteredTasks.filter((task) => task.scope === 'FAMILY')
  const personalTasks = filteredTasks.filter((task) => task.scope === 'PERSONAL')

  const renderCard = (task: TaskDefinition) => (
    <TaskDefinitionCard
      key={task.id}
      task={task}
      members={members}
      onEdit={handleEdit}
      onDelete={handleDeleteClick}
      canEdit={canEditTask(task)}
      showDescription
    />
  )

  return (
    <>
      <Header
        title="タスク一覧"
        subtitle={`${filteredTasks.length}件の設定`}
        showBack
        action={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            aria-label="最新の状態に更新"
            className="w-11 h-11 rounded-full bg-surface text-accent flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-5 h-5', loading && 'animate-spin')} />
          </button>
        }
      />
      <PageContainer>
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* 検索とフィルター */}
        <section className="pt-1 pb-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-muted" />
            <input
              type="search"
              aria-label="タスクを検索"
              placeholder="タスクを検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-surface border-none text-base text-ink placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <Segmented
            label="表示する範囲"
            value={filterScope}
            onChange={(scope) => handleFilterScopeChange(scope)}
            options={[
              { value: 'ALL', label: 'すべて' },
              { value: 'FAMILY', label: '家族' },
              { value: 'PERSONAL', label: '個人' },
            ]}
          />

          {filterScope === 'PERSONAL' && members.length > 0 && (
            <div role="group" aria-label="メンバーで絞り込み" className="flex gap-2 flex-wrap">
              <button
                type="button"
                aria-pressed={filterMemberId === null}
                onClick={() => setFilterMemberId(null)}
                className={clsx(
                  'h-10 px-3.5 rounded-full text-sm min-h-[40px]',
                  filterMemberId === null ? 'bg-accent text-white font-bold' : 'bg-surface text-ink-soft font-medium'
                )}
              >
                全員
              </button>
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  aria-pressed={filterMemberId === member.id}
                  onClick={() => setFilterMemberId(member.id)}
                  className={clsx(
                    'h-10 px-3.5 rounded-full text-sm',
                    filterMemberId === member.id ? 'bg-accent text-white font-bold' : 'bg-surface text-ink-soft font-medium'
                  )}
                >
                  {member.id === user?.id ? '自分' : member.name}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* タスク一覧 */}
        <section className="space-y-3">
          {familyTasks.length > 0 && (
            <SectionBox title="家族のタスク" meta={`${familyTasks.length}件`}>
              {familyTasks.map(renderCard)}
            </SectionBox>
          )}
          {personalTasks.length > 0 && (
            <SectionBox
              title={filterMemberId && filterMemberId === user?.id ? '自分のタスク' : '個人のタスク'}
              meta={`${personalTasks.length}件`}
            >
              {personalTasks.map(renderCard)}
            </SectionBox>
          )}

          {filteredTasks.length === 0 && (
            <div className="bg-surface rounded-box py-10 text-center">
              <p className="text-ink-muted font-medium">タスク設定が見つかりません</p>
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
                size="lg"
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
                size="lg"
                className="flex-1"
                onClick={handleConfirmDelete}
                loading={loading}
              >
                削除
              </Button>
            </>
          }
        >
          <p className="text-ink text-[15px] leading-relaxed">
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
