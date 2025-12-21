import { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface PageContainerProps {
  children: ReactNode
  className?: string
  noPadding?: boolean
}

export function PageContainer({ children, className, noPadding = false }: PageContainerProps) {
  return (
    <main
      className={clsx(
        'min-h-screen pb-20 max-w-lg mx-auto',
        !noPadding && 'px-4',
        className
      )}
    >
      {children}
    </main>
  )
}
