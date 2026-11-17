'use client'

// The one place that reads and writes the player's save in localStorage. Every screen uses
// this hook, so the save format and keys live in lib/save.ts only.
import { useCallback, useEffect, useState } from 'react'
import { LEGACY_SAVE_KEY, SAVE_KEY, freshSave, loadSave, type SaveData } from '../lib/save'
import { levelSize, levels } from '../lib/levels'

export function useSave() {
  const [save, setSave] = useState<SaveData>(freshSave)
  const [loaded, setLoaded] = useState(false)

  // Load once on the client (localStorage does not exist during server rendering).
  useEffect(() => {
    let loadedSave = freshSave()
    try {
      // v2 save if present, otherwise migrate the v1 save (left in place as a backup)
      loadedSave = loadSave(localStorage.getItem(SAVE_KEY), localStorage.getItem(LEGACY_SAVE_KEY), levels.length, levelSize).save
    } catch { /* storage blocked */ }
    // Clear the old ?dev unlock-all flag left in this tab by earlier builds.
    try { sessionStorage.removeItem('merge-to-escape:dev') } catch { /* storage blocked */ }
    setSave(loadedSave)
    setLoaded(true)
  }, [])

  // Persist every change after the initial load.
  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch { /* storage full or blocked */ }
  }, [save, loaded])

  /** Wipes all progress (v2 save and the v1 backup) and starts again from level 1. */
  const resetProgress = useCallback(() => {
    try { localStorage.removeItem(LEGACY_SAVE_KEY) } catch { /* storage blocked */ }
    setSave(freshSave())
  }, [])

  return { save, setSave, loaded, unlocked: save.unlocked, resetProgress }
}
