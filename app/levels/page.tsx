'use client'

// Level map: ten chapter cards; the open chapter shows its ten chambers. Locked chambers
// cannot be picked; cleared ones show their best result; boss chambers wear a crown.
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Crown, Lock } from 'lucide-react'
import { levels } from '../../lib/levels'
import { chapterSummaries, levelStatus } from '../../lib/map'
import { starsForLevel } from '../../lib/save'
import { Purse } from '../../components/Purse'
import { TopBar } from '../../components/TopBar'
import { bossClip, bossKindFor, BOSS_NAMES } from '../../components/sprites'
import { useSave } from '../../components/useSave'

export default function LevelsPage() {
  const { save, loaded, unlocked, devUnlockAll } = useSave()
  const chapters = useMemo(() => chapterSummaries(levels, save, unlocked), [save, unlocked])
  const [openChapter, setOpenChapter] = useState<number | null>(null)
  const current = chapters.find((c) => c.isCurrent)?.chapter ?? 1
  const shown = openChapter ?? current
  const currentRef = useRef<HTMLDivElement | null>(null)

  // Bring the player's chapter into view once the save is loaded.
  useEffect(() => {
    if (loaded) currentRef.current?.scrollIntoView({ block: 'center' })
  }, [loaded])

  return (
    <main className="game-shell map-screen">
      <TopBar back="/" />

      <section className="map-content">
        <div className="map-heading">
          <div>
            <p className="eyebrow">Ten chapters · one hundred chambers</p>
            <h1>Level Map</h1>
          </div>
          <Purse gold={save.gold} stars={save.stars} />
        </div>
        {devUnlockAll && <p className="map-dev"><span className="dev-tag">DEV · all levels unlocked</span></p>}

        <div className="chapter-list">
          {chapters.map((c) => {
            const isOpen = shown === c.chapter && !c.locked
            const boss = bossKindFor(c.chapter)
            return (
              <div
                key={c.chapter}
                ref={c.isCurrent ? currentRef : undefined}
                className={`chapter-card${c.locked ? ' locked' : ''}${isOpen ? ' open' : ''}${c.isCurrent ? ' current' : ''}`}
              >
                <button
                  className="chapter-head"
                  disabled={c.locked}
                  aria-expanded={isOpen}
                  onClick={() => setOpenChapter(isOpen ? -1 : c.chapter)}
                >
                  <span
                    className="chapter-boss"
                    style={{ backgroundImage: `url(${bossClip(boss, 'idle', 'front')})` }}
                    title={`Boss: ${BOSS_NAMES[boss]}`}
                    aria-hidden
                  />
                  <span className="chapter-info">
                    <small>Chapter {c.chapter} · {c.sizes.map((n) => `${n}×${n}`).join(' / ')}</small>
                    <strong>{c.name}</strong>
                    <span className="chapter-bar"><span style={{ width: `${(c.cleared / (c.to - c.from + 1)) * 100}%` }} /></span>
                  </span>
                  <span className="chapter-stats">
                    {c.locked
                      ? <Lock size={20} aria-label="Locked" />
                      : <>
                          <span>{c.cleared}/{c.to - c.from + 1}</span>
                          <span className="stars"><i aria-hidden>★</i>{c.starsEarned}/{c.starsTotal}</span>
                        </>}
                  </span>
                </button>

                {isOpen && (
                  <div className="level-grid">
                    {Array.from({ length: c.to - c.from + 1 }, (_, k) => c.from + k).map((i) => {
                      const status = levelStatus(i, save, unlocked)
                      const lvl = levels[i]
                      const record = save.records[i]
                      const label = `Level ${i + 1}${lvl.hasBoss ? ' (boss)' : ''}`
                      const body = (
                        <>
                          {lvl.hasBoss && <Crown className="level-crown" size={16} aria-hidden />}
                          <span className="level-num">{i + 1}</span>
                          <span className="level-sub">
                            {status === 'locked' ? <Lock size={14} aria-hidden />
                              : status === 'current' ? (save.run?.level === i ? 'Resume' : 'Play')
                                : record ? <><Check size={13} aria-hidden />{record.bestMoves}</>
                                  : <><i aria-hidden>★</i>{starsForLevel(i)}</>}
                          </span>
                        </>
                      )
                      return status === 'locked'
                        ? <div key={i} className="level-tile locked" aria-label={`${label}, locked`}>{body}</div>
                        : (
                          <Link
                            key={i}
                            href={`/play?level=${i + 1}`}
                            className={`level-tile ${status}${lvl.hasBoss ? ' boss' : ''}`}
                            aria-label={`${label}${record ? `, cleared in ${record.bestMoves} moves` : ''}${status === 'current' ? ', current' : ''}`}
                          >
                            {body}
                          </Link>
                        )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
