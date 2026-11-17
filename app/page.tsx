'use client'

// Home screen: continue / play, the hero, the wallet, and the menus of the meta game
// (level map, upgrades and shop arrive in phases 9.5-9.7).
import Link from 'next/link'
import { useState } from 'react'
import { Settings, X } from 'lucide-react'
import { levels } from '../lib/levels'
import { ART } from '../components/art'
import { Purse } from '../components/Purse'
import { TopBar } from '../components/TopBar'
import { WizardSprite } from '../components/sprites'
import { useSave } from '../components/useSave'

const MENU = [
  { key: 'map', title: 'Level Map', blurb: '10 chapters, 100 chambers', icon: ART.treasureMap, href: '/levels', phase: '9.5', ready: true },
  { key: 'upgrades', title: 'Upgrades', blurb: 'Spend stars on talents', icon: ART.spellbook, href: '/upgrades', phase: '9.6', ready: true },
  { key: 'shop', title: 'Shop', blurb: 'Hammers, scrolls, potions', icon: ART.chest, href: '/shop', phase: '9.7', ready: true },
] as const

export default function HomePage() {
  const { save, setSave, loaded, resetProgress } = useSave()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const cleared = Object.keys(save.records).length
  const isNewPlayer = cleared === 0 && save.current === 0 && !save.run
  const level = levels[save.current]

  const closeSettings = () => { setSettingsOpen(false); setConfirmReset(false) }

  return (
    <main className="game-shell home">
      <TopBar
        actions={(
          <button className="icon-button" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings size={19} />
          </button>
        )}
      />

      <section className="home-content">
        <div className="home-hero">
          <p className="eyebrow">An escape-room merge adventure</p>
          <h1 className="home-title">Merge to Escape</h1>
          <div className="home-wizard" aria-hidden>
            <span className="home-wizard-glow" />
            <WizardSprite action="idle" nonce={0} facing={1} />
          </div>
        </div>

        <Purse gold={save.gold} stars={save.stars} />

        <div className="home-play">
          <Link href="/play" className={`primary-button home-play-button${loaded ? '' : ' is-loading'}`}>
            {isNewPlayer ? 'Play' : `Continue — Level ${save.current + 1}`}
          </Link>
          <p className="home-play-sub">
            {isNewPlayer
              ? 'Merge the treasures, slide to the door, escape the dungeon.'
              : save.run
                ? `${level.chapterName} · run in progress (${save.run.moves} moves)`
                : `${level.chapterName} · ${level.name}`}
          </p>
        </div>

        <nav className="home-menu" aria-label="Main menu">
          {MENU.map((m) => {
            const inner = (
              <>
                <img src={m.icon} alt="" draggable={false} />
                <div>
                  <strong>{m.title}</strong>
                  <span>{m.blurb}</span>
                </div>
                {m.key === 'upgrades' && save.stars > 0 && <em className="home-badge">★ {save.stars}</em>}
                {!m.ready && <small className="soon-tag">Soon</small>}
              </>
            )
            return m.ready
              ? <Link key={m.key} href={m.href} className="home-card">{inner}</Link>
              : <div key={m.key} className="home-card is-soon" aria-disabled title={`Coming in phase ${m.phase}`}>{inner}</div>
          })}
        </nav>

        <p className="home-progress">
          <img src={ART.trophy} alt="" draggable={false} />
          {cleared} / {levels.length} chambers cleared
        </p>
      </section>

      {settingsOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal aria-label="Settings" onClick={closeSettings}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close icon-button" aria-label="Close" onClick={closeSettings}><X size={18} /></button>
            <h2>Settings</h2>

            <label className="setting-row">
              <span>Sound <small>(sound effects are coming later)</small></span>
              <input
                type="checkbox"
                checked={save.settings.sound}
                onChange={(e) => setSave((s) => ({ ...s, settings: { ...s.settings, sound: e.target.checked } }))}
              />
            </label>

            <div className="setting-row danger">
              <span>Reset progress <small>levels, gold, stars, talents and records</small></span>
              {confirmReset ? (
                <span className="confirm-reset">
                  <button className="secondary-button" onClick={() => setConfirmReset(false)}>Cancel</button>
                  <button className="danger-button" onClick={() => { resetProgress(); closeSettings() }}>Delete everything</button>
                </span>
              ) : (
                <button className="secondary-button" onClick={() => setConfirmReset(true)}>Reset…</button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
