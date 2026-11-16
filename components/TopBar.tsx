// Shared top bar: back button (to a screen), brand, and an optional right-side action.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ART } from './art'

export function TopBar({ back, backLabel = 'Back to menu', actions }: {
  /** Route the back button goes to; omit on the home screen. */
  back?: string
  backLabel?: string
  actions?: ReactNode
}) {
  return (
    <header className="topbar">
      {back
        ? <Link href={back} className="icon-button" aria-label={backLabel} title={backLabel}><ArrowLeft size={20} /></Link>
        : <span className="icon-button-spacer" aria-hidden />}
      <div className="brand">
        <div className="brand-mark"><img src={ART.brand} alt="" draggable={false} /></div>
        <span>Merge to Escape</span>
      </div>
      <div className="top-actions">{actions ?? <span className="icon-button-spacer" aria-hidden />}</div>
    </header>
  )
}
