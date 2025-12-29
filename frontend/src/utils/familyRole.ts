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

/**
 * FamilyRoleの日本語ラベルを取得
 *
 * @param role - FamilyRole
 * @returns 日本語表示名
 *
 * @example
 * ```typescript
 * getFamilyRoleLabel('FATHER') // '父'
 * getFamilyRoleLabel('MOTHER') // '母'
 * getFamilyRoleLabel('BROTHER') // '兄弟'
 * getFamilyRoleLabel('SISTER') // '姉妹'
 * ```
 */
export function getFamilyRoleLabel(role: FamilyRole): string {
  const labels: Record<FamilyRole, string> = {
    FATHER: '父',
    MOTHER: '母',
    BROTHER: '兄弟',
    SISTER: '姉妹',
  }
  return labels[role] || role
}

