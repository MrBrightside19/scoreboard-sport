import type { Component } from 'vue'
import { parseSportId, type SportId } from '@/types/sport'
import type { TvScoreboardStyle } from '@/config/scoreboardStyles'
import { TV_STYLES_BY_SPORT } from '@/config/scoreboardStyles'
import HockeyControls from '@/sports/hockey/HockeyControls.vue'
import HockeyScoreBoard from '@/sports/hockey/HockeyScoreBoard.vue'
import HockeyTvBoard from '@/sports/hockey/HockeyTvBoard.vue'
import HockeyOverlayBoard from '@/sports/hockey/HockeyOverlayBoard.vue'
import FutsalControls from '@/sports/futsal/FutsalControls.vue'
import FutsalTvBoard from '@/sports/futsal/FutsalTvBoard.vue'
import BasketballControls from '@/sports/basketball/BasketballControls.vue'
import BasketballTvBoard from '@/sports/basketball/BasketballTvBoard.vue'
import FootballControls from '@/sports/football/FootballControls.vue'
import FootballTvBoard from '@/sports/football/FootballTvBoard.vue'

/**
 * Live y Overlay usan siempre el diseño principal (HockeyScoreBoard).
 * TV puede variar por deporte. Controls adaptan reglas pero el layout es el de hockey.
 */
export interface SportUi {
  Controls: Component
  Live: Component
  Tv: Component
  Overlay: Component
  tvStyles: TvScoreboardStyle[]
}

const UI: Record<SportId, SportUi> = {
  hockey: {
    Controls: HockeyControls,
    Live: HockeyScoreBoard,
    Tv: HockeyTvBoard,
    Overlay: HockeyOverlayBoard,
    tvStyles: TV_STYLES_BY_SPORT.hockey,
  },
  futsal: {
    Controls: FutsalControls,
    Live: HockeyScoreBoard,
    Tv: FutsalTvBoard,
    Overlay: HockeyOverlayBoard,
    tvStyles: TV_STYLES_BY_SPORT.futsal,
  },
  basketball: {
    Controls: BasketballControls,
    Live: HockeyScoreBoard,
    Tv: BasketballTvBoard,
    Overlay: HockeyOverlayBoard,
    tvStyles: TV_STYLES_BY_SPORT.basketball,
  },
  football: {
    Controls: FootballControls,
    Live: HockeyScoreBoard,
    Tv: FootballTvBoard,
    Overlay: HockeyOverlayBoard,
    tvStyles: TV_STYLES_BY_SPORT.football,
  },
}

export function getSportUi(sport?: string | null): SportUi {
  return UI[parseSportId(sport)]
}
