import { basketballSport } from '@/sports/basketball'
import { footballSport } from '@/sports/football'
import { futsalSport } from '@/sports/futsal'
import { hockeySport } from '@/sports/hockey'
import type { SportModule } from '@/sports/types'
import { DEFAULT_SPORT, parseSportId, type SportId } from '@/types/sport'

const MODULES: Record<SportId, SportModule> = {
  hockey: hockeySport,
  futsal: futsalSport,
  basketball: basketballSport,
  football: footballSport,
}

export function getSportModule(sport?: string | null): SportModule {
  return MODULES[parseSportId(sport)] ?? MODULES[DEFAULT_SPORT]
}

export function listSportModules(): SportModule[] {
  return Object.values(MODULES)
}

export function listAvailableSports(): SportModule[] {
  return listSportModules().filter((sport) => sport.available)
}
