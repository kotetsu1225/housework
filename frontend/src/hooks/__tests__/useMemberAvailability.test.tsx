/**
 * useMemberAvailabilityフックのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMemberAvailability } from '../useMemberAvailability'
import * as api from '../../api'

// APIモジュールをモック
vi.mock('../../api', () => ({
  getMemberAvailabilities: vi.fn(),
  createMemberAvailability: vi.fn(),
  updateMemberAvailability: vi.fn(),
  deleteMemberAvailabilitySlots: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message)
    }
  },
}))

const mockAvailabilities = [
  {
    id: 'avail-1',
    memberId: 'member-1',
    targetDate: '2024-01-15',
    slots: [
      { startTime: '10:00', endTime: '12:00', memo: '午前' },
      { startTime: '14:00', endTime: '17:00', memo: '午後' },
    ],
  },
]

describe('useMemberAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初期状態', () => {
    it('初期値なしで空配列が返される', () => {
      const { result } = renderHook(() => useMemberAvailability())
      expect(result.current.availabilities).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('初期値ありで初期値が返される', () => {
      const { result } = renderHook(() => useMemberAvailability(mockAvailabilities))
      expect(result.current.availabilities).toEqual(mockAvailabilities)
    })
  })

  describe('fetchAvailabilities', () => {
    it('空き時間一覧を取得できる', async () => {
      vi.mocked(api.getMemberAvailabilities).mockResolvedValueOnce({
        availabilities: [
          {
            id: 'avail-1',
            memberId: 'member-1',
            targetDate: '2024-01-15',
            slots: [{ startTime: '10:00', endTime: '12:00', memo: 'テスト' }],
          },
        ],
      })

      const { result } = renderHook(() => useMemberAvailability())

      await act(async () => {
        await result.current.fetchAvailabilities('member-1')
      })

      expect(result.current.availabilities).toHaveLength(1)
      expect(result.current.availabilities[0].slots[0].startTime).toBe('10:00')
    })

    it('取得中はloadingがtrueになる', async () => {
      vi.mocked(api.getMemberAvailabilities).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      const { result } = renderHook(() => useMemberAvailability())

      act(() => {
        result.current.fetchAvailabilities('member-1')
      })

      expect(result.current.loading).toBe(true)
    })

    it('エラー時にerrorが設定される', async () => {
      vi.mocked(api.getMemberAvailabilities).mockRejectedValueOnce(
        new Error('取得エラー')
      )

      const { result } = renderHook(() => useMemberAvailability())

      await act(async () => {
        await result.current.fetchAvailabilities('member-1')
      })

      expect(result.current.error).toBe('取得エラー')
    })
  })

  describe('addAvailability', () => {
    it('空き時間を追加できる', async () => {
      vi.mocked(api.createMemberAvailability).mockResolvedValueOnce({
        id: 'new-avail',
        memberId: 'member-1',
        targetDate: '2024-01-20',
        slots: [{ startTime: '09:00', endTime: '11:00', memo: '朝' }],
      })

      const { result } = renderHook(() => useMemberAvailability())

      let success: boolean
      await act(async () => {
        success = await result.current.addAvailability('member-1', '2024-01-20', [
          { startTime: '09:00', endTime: '11:00', memo: '朝' },
        ])
      })

      expect(success!).toBe(true)
      expect(result.current.availabilities).toHaveLength(1)
    })

    it('追加失敗時はfalseを返す', async () => {
      vi.mocked(api.createMemberAvailability).mockRejectedValueOnce(
        new Error('追加失敗')
      )

      const { result } = renderHook(() => useMemberAvailability())

      let success: boolean
      await act(async () => {
        success = await result.current.addAvailability('member-1', '2024-01-20', [])
      })

      expect(success!).toBe(false)
      expect(result.current.error).toBe('追加失敗')
    })
  })

  describe('editAvailability', () => {
    it('空き時間を更新できる', async () => {
      vi.mocked(api.updateMemberAvailability).mockResolvedValueOnce({
        id: 'avail-1',
        memberId: 'member-1',
        targetDate: '2024-01-15',
        slots: [{ startTime: '11:00', endTime: '13:00', memo: '更新済み' }],
      })

      const { result } = renderHook(() => useMemberAvailability(mockAvailabilities))

      let success: boolean
      await act(async () => {
        success = await result.current.editAvailability('avail-1', [
          { startTime: '11:00', endTime: '13:00', memo: '更新済み' },
        ])
      })

      expect(success!).toBe(true)
      expect(result.current.availabilities[0].slots[0].startTime).toBe('11:00')
    })
  })

  describe('removeSlots', () => {
    it('スロットを削除できる', async () => {
      vi.mocked(api.deleteMemberAvailabilitySlots).mockResolvedValueOnce({
        id: 'avail-1',
        memberId: 'member-1',
        targetDate: '2024-01-15',
        slots: [{ startTime: '14:00', endTime: '17:00', memo: '午後' }],
      })

      const { result } = renderHook(() => useMemberAvailability(mockAvailabilities))

      let success: boolean
      await act(async () => {
        success = await result.current.removeSlots('avail-1', [
          { startTime: '10:00', endTime: '12:00' },
        ])
      })

      expect(success!).toBe(true)
      expect(result.current.availabilities[0].slots).toHaveLength(1)
    })
  })

  describe('setAvailabilities', () => {
    it('空き時間一覧を直接設定できる', () => {
      const { result } = renderHook(() => useMemberAvailability())

      act(() => {
        result.current.setAvailabilities(mockAvailabilities)
      })

      expect(result.current.availabilities).toEqual(mockAvailabilities)
    })
  })

  describe('clearError', () => {
    it('エラーをクリアできる', async () => {
      vi.mocked(api.getMemberAvailabilities).mockRejectedValueOnce(
        new Error('エラー')
      )

      const { result } = renderHook(() => useMemberAvailability())

      await act(async () => {
        await result.current.fetchAvailabilities('member-1')
      })

      expect(result.current.error).toBe('エラー')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})

