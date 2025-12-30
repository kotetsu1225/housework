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

// public配下の画像はハッシュ化されないため、差し替えが反映されない場合に備えてバージョンを付与
const ICON_VERSION = '2025-12-30'

/**
 * 役割選択オプション一覧
 */
export const ROLE_OPTIONS: RoleOption[] = [
  { value: 'FATHER', label: '父', icon: `/familyIcons/father.jpg?v=${ICON_VERSION}` },
  { value: 'MOTHER', label: '母', icon: `/familyIcons/mother.jpg?v=${ICON_VERSION}` },
  { value: 'BROTHER', label: '兄', icon: `/familyIcons/brother.jpg?v=${ICON_VERSION}` },
  { value: 'SISTER', label: '妹', icon: `/familyIcons/sister.jpg?v=${ICON_VERSION}` },
] as const

/**
 * 役割ラベルマップ（表示用）
 */
export const ROLE_LABELS: Record<FamilyRole, string> = {
  FATHER: '父',
  MOTHER: '母',
  BROTHER: '兄',
  SISTER: '妹',
} as const

/**
 * 親役割一覧
 */
export const PARENT_ROLES: FamilyRole[] = ['FATHER', 'MOTHER'] as const

/**
 * 子役割一覧
 */
export const CHILD_ROLES: FamilyRole[] = ['BROTHER', 'SISTER'] as const

