/**
 * useMemberフックのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMember } from '../useMember'
import * as api from '../../api'
import type { Member } from '../../types'

// APIモジュールをモック
vi.mock('../../api', () => ({
  getMembers: vi.fn(),
  createMember: vi.fn(),
  updateMember: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message)
    }
  },
}))

const mockMembers: Member[] = [
  {
    id: 'member-1',
    name: '太郎',
    email: 'taro@example.com',
    role: 'BROTHER',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'member-2',
    name: '花子',
    email: 'hanako@example.com',
    role: 'SISTER',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

describe('useMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初期状態', () => {
    it('初期メンバーなしで空配列が返される', () => {
      const { result } = renderHook(() => useMember())
      expect(result.current.members).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('初期メンバーありで初期値が返される', () => {
      const { result } = renderHook(() => useMember(mockMembers))
      expect(result.current.members).toEqual(mockMembers)
    })
  })

  describe('fetchMembers', () => {
    it('メンバー一覧を取得できる', async () => {
      vi.mocked(api.getMembers).mockResolvedValueOnce({
        members: [
          { id: 'member-1', name: '太郎', email: 'taro@example.com', familyRole: 'BROTHER' },
          { id: 'member-2', name: '花子', email: 'hanako@example.com', familyRole: 'SISTER' },
        ],
      })

      const { result } = renderHook(() => useMember())

      await act(async () => {
        await result.current.fetchMembers()
      })

      expect(result.current.members).toHaveLength(2)
      expect(result.current.members[0].name).toBe('太郎')
    })

    it('取得中はloadingがtrueになる', async () => {
      vi.mocked(api.getMembers).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      const { result } = renderHook(() => useMember())

      act(() => {
        result.current.fetchMembers()
      })

      expect(result.current.loading).toBe(true)
    })

    it('エラー時にerrorが設定される', async () => {
      vi.mocked(api.getMembers).mockRejectedValueOnce(new Error('ネットワークエラー'))

      const { result } = renderHook(() => useMember())

      await act(async () => {
        await result.current.fetchMembers()
      })

      expect(result.current.error).toBe('ネットワークエラー')
    })
  })

  describe('addMember', () => {
    it('メンバーを追加できる', async () => {
      vi.mocked(api.createMember).mockResolvedValueOnce({
        id: 'new-member',
        name: '次郎',
        email: 'jiro@example.com',
        familyRole: 'BROTHER',
      })

      const { result } = renderHook(() => useMember())

      let success: boolean
      await act(async () => {
        success = await result.current.addMember('次郎', 'jiro@example.com', 'BROTHER', 'password123')
      })

      expect(success!).toBe(true)
      expect(result.current.members).toHaveLength(1)
      expect(result.current.members[0].name).toBe('次郎')
    })

    it('追加失敗時はfalseを返す', async () => {
      vi.mocked(api.createMember).mockRejectedValueOnce(new Error('追加失敗'))

      const { result } = renderHook(() => useMember())

      let success: boolean
      await act(async () => {
        success = await result.current.addMember('次郎', 'jiro@example.com', 'BROTHER', 'password123')
      })

      expect(success!).toBe(false)
      expect(result.current.error).toBe('追加失敗')
    })
  })

  describe('editMember', () => {
    it('メンバーを更新できる', async () => {
      vi.mocked(api.updateMember).mockResolvedValueOnce({
        id: 'member-1',
        name: '太郎（更新）',
        familyRole: 'FATHER',
      })

      const { result } = renderHook(() => useMember(mockMembers))

      let success: boolean
      await act(async () => {
        success = await result.current.editMember('member-1', '太郎（更新）', 'FATHER')
      })

      expect(success!).toBe(true)
      expect(result.current.members[0].name).toBe('太郎（更新）')
      expect(result.current.members[0].role).toBe('FATHER')
    })

    it('更新失敗時はfalseを返す', async () => {
      vi.mocked(api.updateMember).mockRejectedValueOnce(new Error('更新失敗'))

      const { result } = renderHook(() => useMember(mockMembers))

      let success: boolean
      await act(async () => {
        success = await result.current.editMember('member-1', '更新', 'FATHER')
      })

      expect(success!).toBe(false)
      expect(result.current.error).toBe('更新失敗')
    })
  })

  describe('setMembers', () => {
    it('メンバー一覧を直接設定できる', () => {
      const { result } = renderHook(() => useMember())

      act(() => {
        result.current.setMembers(mockMembers)
      })

      expect(result.current.members).toEqual(mockMembers)
    })
  })

  describe('clearError', () => {
    it('エラーをクリアできる', async () => {
      vi.mocked(api.getMembers).mockRejectedValueOnce(new Error('エラー'))

      const { result } = renderHook(() => useMember())

      await act(async () => {
        await result.current.fetchMembers()
      })

      expect(result.current.error).toBe('エラー')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})

