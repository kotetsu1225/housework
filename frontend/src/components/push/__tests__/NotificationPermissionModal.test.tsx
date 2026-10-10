import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationPermissionModal } from '../NotificationPermissionModal'

vi.mock('../../ui/Modal', () => ({
  Modal: ({ isOpen, children }: any) => (isOpen ? <div>{children}</div> : null),
}))

const renderModal = (overrides: Partial<Parameters<typeof NotificationPermissionModal>[0]> = {}) => {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onAllow: vi.fn().mockResolvedValue(undefined),
    onDismiss: vi.fn(),
    ...overrides,
  }
  render(<NotificationPermissionModal {...props} />)
  return props
}

describe('NotificationPermissionModal', () => {
  it('登録エラーがあればメッセージを表示する(別の家族で登録済み = 409 など、#48)', () => {
    renderModal({ error: 'この端末は別の家族のアカウントで通知登録されています' })

    expect(screen.getByText('この端末は別の家族のアカウントで通知登録されています')).toBeInTheDocument()
  })

  it('エラーが無ければメッセージを表示しない', () => {
    renderModal()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/別の家族/)).not.toBeInTheDocument()
  })

  it('「許可する」は onAllow だけを呼び、モーダル自身では閉じない(失敗時に理由を見せるため。成功時は呼び出し側が閉じる)', async () => {
    const props = renderModal()

    fireEvent.click(screen.getByText('許可する'))

    await waitFor(() => expect(props.onAllow).toHaveBeenCalledTimes(1))
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('「今はしない」は onDismiss を呼んで閉じる(従来どおり)', () => {
    const props = renderModal()

    fireEvent.click(screen.getByText('今はしない'))

    expect(props.onDismiss).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
