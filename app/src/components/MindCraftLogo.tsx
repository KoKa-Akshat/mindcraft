import { Link } from 'react-router-dom'
import s from './MindCraftLogo.module.css'

type Props = {
  to?: string
  className?: string
  size?: 'sm' | 'md'
}

export default function MindCraftLogo({ to = '/dashboard', className, size = 'md' }: Props) {
  const text = (
    <span className={`${s.text} ${s[size]}`}>
      Mind<span className={s.craft}>Craft</span>
    </span>
  )

  if (!to) return <span className={className}>{text}</span>

  return (
    <Link to={to} className={`${s.link} ${className ?? ''}`}>
      {text}
    </Link>
  )
}
