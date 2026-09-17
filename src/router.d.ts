import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    bare?: boolean
    /** Fondo transparente para OBS / Browser Source */
    transparent?: boolean
    hideNav?: boolean
    requiresStaff?: boolean
    requiresAuth?: boolean
    /** Hub de mesa: solo teléfonos / pantallas angostas. */
    mobileOnly?: boolean
    /** Organizador (crear partido / torneo): solo escritorio. */
    desktopOnly?: boolean
    nav?: 'marketing' | 'app'
  }
}
