import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../client'

describe('apiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it.each([
    ['zero', 0, '0'],
    ['false', false, 'false'],
    ['empty string', '', '""'],
    ['null', null, 'null'],
  ])('serializes a %s request body', async (_name, body, expectedBody) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 })
    )

    await apiClient('/test', {
      method: 'POST',
      body,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(expectedBody)
  })

  it('omits the request body when it is undefined', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 })
    )

    await apiClient('/test', { method: 'POST' })

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined()
  })
})
