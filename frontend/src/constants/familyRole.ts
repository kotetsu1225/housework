/**
 * FamilyRole関連の定数
 *
 * 役割の定義、表示用ラベル、アイコンパスなど
 */

import type { FamilyRole } from '../types'

/**
 * 役割オプション（UI選択用）
 */
export interface RoleOption {
  value: FamilyRole
  label: string
  icon: string
}

/**
 * 役割選択オプション一覧
 */
export const ROLE_OPTIONS: RoleOption[] = [
  { value: 'FATHER', label: '父', icon: '/familyIcons/father.svg.jpg' },
  { value: 'MOTHER', label: '母', icon: '/familyIcons/mother.svg.jpg' },
  { value: 'BROTHER', label: '兄弟', icon: '/familyIcons/brother.svg.jpg' },
  { value: 'SISTER', label: '姉妹', icon: '/familyIcons/sister.svg.jpg' },
] as const

/**
 * 役割ラベルマップ（表示用）
 */
export const ROLE_LABELS: Record<FamilyRole, string> = {
  FATHER: '父',
  MOTHER: '母',
  BROTHER: '兄弟',
  SISTER: '姉妹',
} as const

/**
 * 親役割一覧
 */
export const PARENT_ROLES: FamilyRole[] = ['FATHER', 'MOTHER'] as const

/**
 * 子役割一覧
 */
export const CHILD_ROLES: FamilyRole[] = ['BROTHER', 'SISTER'] as const

