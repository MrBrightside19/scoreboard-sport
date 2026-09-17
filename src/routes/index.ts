import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { isMobileMesaViewport } from '@/utils/mobileMesa'
import { readMatchIdFromStorage } from '@/utils/localSync'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('@/views/Landing.vue'),
      meta: { title: 'ScoreDesk', nav: 'marketing' },
    },
    {
      path: '/en-vivo',
      name: 'live-now',
      component: () => import('@/views/Home.vue'),
      meta: { title: 'En vivo' },
    },
    {
      path: '/app',
      name: 'app-home',
      component: () => import('@/views/AppHome.vue'),
      meta: { title: 'App', requiresAuth: true, desktopOnly: true },
    },
    {
      path: '/app/mesa',
      name: 'mobile-mesa',
      component: () => import('@/views/MobileMesa.vue'),
      meta: {
        title: 'Mesa móvil',
        hideNav: true,
        mobileOnly: true,
      },
    },
    {
      path: '/app/acceso',
      name: 'access',
      component: () => import('@/views/Access.vue'),
      meta: { title: 'Acceso', nav: 'marketing' },
    },
    {
      path: '/app/planes',
      name: 'plans',
      component: () => import('@/views/Plans.vue'),
      meta: { title: 'Planes', requiresAuth: true },
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
    {
      path: '/perfil',
      name: 'profile',
      component: () => import('@/views/Profile.vue'),
      meta: { requiresAuth: true, title: 'Perfil' },
    },
    {
      path: '/home',
      redirect: { name: 'live-now' },
    },
  ],
  scrollBehavior: (to) => {
    if (to.hash) return { el: to.hash, top: 72 }
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} · ScoreDesk`
  }

  if (to.meta.mobileOnly && !isMobileMesaViewport()) {
    return { name: 'app-home' }
  }

  if (to.meta.desktopOnly && isMobileMesaViewport()) {
    return { name: 'mobile-mesa' }
  }

  if (to.name === 'controls' && isMobileMesaViewport()) {
    const queryId = typeof to.query.matchId === 'string' ? to.query.matchId.trim() : ''
    if (!queryId && !readMatchIdFromStorage()) {
      return { name: 'mobile-mesa' }
    }
  }

  const needsAuth = Boolean(to.meta.requiresAuth || to.meta.requiresStaff)
  if (!needsAuth) return true

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
    return {
      name: 'access',
      query: {
        reason: to.meta.requiresStaff ? 'staff' : '1',
        redirect: to.fullPath,
      },
    }
  }

  if (to.meta.requiresStaff && !auth.isStaff) {
    return {
      name: 'access',
      query: { reason: 'staff', redirect: to.fullPath },
    }
  }

  return true
})

export default router
