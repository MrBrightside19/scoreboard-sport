import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/Home.vue'),
      meta: { title: 'Inicio' },
    },
    {
      path: '/live/:matchId',
      name: 'live',
      component: () => import('@/views/Live.vue'),
      meta: { bare: true, title: 'En vivo' },
    },
    {
      path: '/overlay/:matchId',
      name: 'overlay',
      component: () => import('@/views/Overlay.vue'),
      meta: { bare: true, title: 'Overlay' },
    },
    {
      path: '/live/torneo/:tournamentId/:court',
      name: 'tournament-live',
      component: () => import('@/views/TournamentLive.vue'),
      meta: { bare: true, title: 'Torneo en vivo' },
    },
    {
      path: '/torneo/:id',
      name: 'tournament-public',
      component: () => import('@/views/TournamentPublic.vue'),
      meta: { title: 'Torneo' },
    },
    {
      path: '/torneos-publicos',
      name: 'public-tournaments',
      component: () => import('@/views/PublicTournaments.vue'),
      meta: { title: 'Torneos públicos' },
    },
    {
      path: '/board',
      name: 'board',
      component: () => import('@/views/Board.vue'),
      meta: { bare: true, requiresOrganizer: true, title: 'Marcador TV' },
    },
    {
      path: '/controls',
      name: 'controls',
      component: () => import('@/views/Controls.vue'),
      meta: { requiresOrganizer: true, title: 'Mesa de control' },
    },
    {
      path: '/tournaments',
      name: 'tournaments',
      component: () => import('@/views/Tournaments.vue'),
      meta: { requiresOrganizer: true, title: 'Torneos' },
    },
    {
      path: '/tournaments/:id',
      name: 'tournament-detail',
      component: () => import('@/views/TournamentDetail.vue'),
      meta: { requiresOrganizer: true, title: 'Detalle torneo' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} · Marcador Hockey`
  }

  if (!to.meta.requiresOrganizer) return true

  const auth = useAuthStore()
  if (auth.loading) {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!auth.loading) {
          clearInterval(check)
          resolve()
        }
      }, 50)
    })
  }

  if (!auth.isOrganizer) {
    return { name: 'home', query: { auth: 'organizer' } }
  }

  return true
})

export default router
