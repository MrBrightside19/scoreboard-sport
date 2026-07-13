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
      meta: { title: 'En vivo' },
    },
    {
      path: '/overlay/:matchId',
      name: 'overlay',
      component: () => import('@/views/Overlay.vue'),
      meta: { bare: true, hideNav: true, transparent: true, title: 'Overlay' },
    },
    {
      path: '/live/torneo/:tournamentId/:court',
      name: 'tournament-live',
      component: () => import('@/views/TournamentLive.vue'),
      meta: { title: 'Torneo en vivo' },
    },
    {
      path: '/overlay/torneo/:tournamentId/:court',
      name: 'tournament-overlay',
      component: () => import('@/views/TournamentLive.vue'),
      meta: { bare: true, hideNav: true, transparent: true, title: 'Overlay torneo' },
    },
    {
      path: '/board/torneo/:tournamentId/:court',
      name: 'tournament-board',
      component: () => import('@/views/TournamentBoard.vue'),
      meta: { bare: true, hideNav: true, title: 'Marcador TV torneo' },
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
      meta: { bare: true, hideNav: true, requiresStaff: true, title: 'Marcador TV' },
    },
    {
      path: '/controls',
      name: 'controls',
      component: () => import('@/views/Controls.vue'),
      meta: { hideNav: true, requiresStaff: true, title: 'Mesa de control' },
    },
    {
      path: '/tournaments',
      name: 'tournaments',
      component: () => import('@/views/Tournaments.vue'),
      meta: { requiresStaff: true, title: 'Torneos' },
    },
    {
      path: '/tournaments/:id',
      name: 'tournament-detail',
      component: () => import('@/views/TournamentDetail.vue'),
      meta: { requiresStaff: true, title: 'Detalle torneo' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} · Marcador Hockey`
  }

  if (!to.meta.requiresStaff) return true

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

  if (!auth.isAuthenticated) {
    return { name: 'home', query: { auth: 'staff' } }
  }

  if (!auth.isStaff) {
    return { name: 'home', query: { auth: 'staff' } }
  }

  return true
})

export default router
