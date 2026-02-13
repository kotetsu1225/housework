import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../Dashboard'

const {
  mockUseDashboard,
  mockUseMembers,
  mockUsePushSubscription,
  mockUseAuth,
} = vi.hoisted(() => ({
  mockUseDashboard: vi.fn(),
  mockUseMembers: vi.fn(),
  mockUsePushSubscription: vi.fn(),
  mockUseAuth: vi.fn(),
}))

vi.mock('../../hooks', () => ({
  useDashboard: mockUseDashboard,
  useMembers: mockUseMembers,
  usePushSubscription: mockUsePushSubscription,
}))

vi.mock('../../contexts', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('../../components/layout/Header', () => ({
  Header: ({ action }: any) => <div>{action}</div>,
}))

vi.mock('../../components/layout/PageContainer', () => ({
  PageContainer: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../../components/ui/Button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}))

vi.mock('../../components/ui/Alert', () => ({
  Alert: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../../components/ui/Card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../../components/ui/Modal', () => ({
  Modal: ({ isOpen, children }: any) => (isOpen ? <div>{children}</div> : null),
}))

vi.mock('../../components/dashboard', () => ({
  ProgressSummaryCard: () => <div />,
  TaskGroupsSection: () => <div />,
  TodayTaskCard: () => <div />,
  TomorrowTaskDetailModal: () => <div />,
}))

vi.mock('../../components/dashboard/TaskActionModal', () => ({
  TaskActionModal: () => <div />,
}))

vi.mock('../../components/push/NotificationPermissionModal', () => ({
  NotificationPermissionModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="notification-modal" /> : null,
}))

const createPushSubscriptionState = (overrides: Record<string, unknown> = {}) => ({
  registration: null,
  permission: 'default' as NotificationPermission,
  subscription: null,
  hasBackendSubscription: false,
  hasPermissionAnswer: false,
  hasCheckedPermissionAnswer: false,
  isCheckingSubscription: false,
  isCheckingPermissionAnswer: false,
  isRegistering: false,
  error: null,
  isSupported: true,
  subscribe: vi.fn().mockResolvedValue(true),
  checkSubscription: vi.fn().mockResolvedValue(undefined),
  savePermissionAnswer: vi.fn().mockResolvedValue(true),
  ...overrides,
})

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )

describe('Dashboard Notification Permission Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseAuth.mockReturnValue({
      user: {
        id: 'member-1',
        name: 'テストユーザー',
      },
    })

    mockUseDashboard.mockReturnValue({
      todayTasks: [],
      loading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
      startTask: vi.fn().mockResolvedValue(true),
      completeTask: vi.fn().mockResolvedValue(true),
      assignTask: vi.fn().mockResolvedValue(true),
      clearError: vi.fn(),
    })

    mockUseMembers.mockReturnValue({
      members: [],
      fetchMembers: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('DB確認が未完了の場合はモーダルを表示しない', async () => {
    mockUsePushSubscription.mockReturnValue(
      createPushSubscriptionState({
        hasCheckedPermissionAnswer: false,
        hasPermissionAnswer: false,
        isCheckingPermissionAnswer: false,
      })
    )

    renderDashboard()

    await waitFor(() => {
      expect(screen.queryByTestId('notification-modal')).not.toBeInTheDocument()
    })
  })

  it('DB確認済みで未回答の場合はモーダルを表示する', async () => {
    mockUsePushSubscription.mockReturnValue(
      createPushSubscriptionState({
        hasCheckedPermissionAnswer: true,
        hasPermissionAnswer: false,
        isCheckingPermissionAnswer: false,
      })
    )

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('notification-modal')).toBeInTheDocument()
    })
  })

  it('DB確認済みで回答済みの場合はモーダルを表示しない', async () => {
    mockUsePushSubscription.mockReturnValue(
      createPushSubscriptionState({
        hasCheckedPermissionAnswer: true,
        hasPermissionAnswer: true,
        isCheckingPermissionAnswer: false,
      })
    )

    renderDashboard()

    await waitFor(() => {
      expect(screen.queryByTestId('notification-modal')).not.toBeInTheDocument()
    })
  })
})
