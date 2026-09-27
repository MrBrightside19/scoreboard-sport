import type { SavedTeamLogo } from '@/utils/userPreferences'

export type UserRole = 'organizer' | 'spectator' | 'assistant'

export interface Profile {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  created_at: string
  saved_team_logos?: SavedTeamLogo[] | null
}
