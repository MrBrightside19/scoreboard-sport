import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    bare?: boolean
    hideNav?: boolean
    requiresStaff?: boolean
  }
}
