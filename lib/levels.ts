// Typed views of lib/game_config.json shared by every screen (play, home, map, upgrades, shop).
import gameConfig from './game_config.json'
import type { EconomyConfig, LevelConfig } from './game-logic'
import type { TalentConfig } from './talents'
import type { ShopPrices } from './shop'

export type GameLevel = LevelConfig & { name: string; chapter: number; chapterName: string; subtitle: string }

export const levels = gameConfig.levels as unknown as GameLevel[]
export const economy = gameConfig.economyConfig as unknown as EconomyConfig
export const talentCfg = gameConfig.economyConfig.talentTreeConfig as unknown as TalentConfig
export const shopPrices = gameConfig.economyConfig.shopPrices as ShopPrices

/** Board side length of a level, for validating saved runs. */
export const levelSize = (levelIndex: number) => levels[levelIndex].size
