/**
 * FamilyRoleユーティリティ関数のテスト
 */

import { describe, it, expect } from 'vitest'
import { isParentRole, getRoleVariant } from '../familyRole'

describe('familyRole utilities', () => {
  describe('isParentRole', () => {
    it('FATHERは親役割としてtrueを返す', () => {
      expect(isParentRole('FATHER')).toBe(true)
    })

    it('MOTHERは親役割としてtrueを返す', () => {
      expect(isParentRole('MOTHER')).toBe(true)
    })

    it('BROTHERは親役割ではないのでfalseを返す', () => {
      expect(isParentRole('BROTHER')).toBe(false)
    })

    it('SISTERは親役割ではないのでfalseを返す', () => {
      expect(isParentRole('SISTER')).toBe(false)
    })
  })

  describe('getRoleVariant', () => {
    it('FATHERに対して"parent"を返す', () => {
      expect(getRoleVariant('FATHER')).toBe('parent')
    })

    it('MOTHERに対して"parent"を返す', () => {
      expect(getRoleVariant('MOTHER')).toBe('parent')
    })

    it('BROTHERに対して"child"を返す', () => {
      expect(getRoleVariant('BROTHER')).toBe('child')
    })

    it('SISTERに対して"child"を返す', () => {
      expect(getRoleVariant('SISTER')).toBe('child')
    })
  })
})

