import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    bare?: boolean
    /** Fondo transparente para OBS / Browser Source */
    transparent?: boolean
    hideNav?: boolean
    requiresStaff?: boolean
  }
}
