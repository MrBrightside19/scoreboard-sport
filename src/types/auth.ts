export type UserRole = 'organizer' | 'spectator'

export interface Profile {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  created_at: string
}
