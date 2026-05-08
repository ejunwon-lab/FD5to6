interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-[rgb(var(--card-bg))] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
