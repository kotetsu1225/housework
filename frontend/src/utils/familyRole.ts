/**
 * FamilyRole関連のユーティリティ関数
 */

import type { FamilyRole } from '../types'
import { PARENT_ROLES } from '../constants'

/**
 * 指定された役割が親（FATHER/MOTHER）かどうかを判定
 *
 * @param role - 判定する役割
 * @returns 親の場合true
 *
 * @example
 * ```typescript
 * isParentRole('FATHER') // true
 * isParentRole('BROTHER') // false
 * ```
 */
export function isParentRole(role: FamilyRole): boolean {
  return PARENT_ROLES.includes(role)
}

/**
 * 役割からAvatarのvariantを取得
 *
 * @param role - FamilyRole
 * @returns 'parent' | 'child'
 */
export function getRoleVariant(role: FamilyRole): 'parent' | 'child' {
  return isParentRole(role) ? 'parent' : 'child'
}

