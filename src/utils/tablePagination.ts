import type { TablePaginationConfig } from 'ant-design-vue'

/**
 * Paginación para tablas de calendario.
 * Usa defaultCurrent/defaultPageSize (no controlada) para que el cambio de
 * página y tamaño funcione sin sincronizar estado a mano.
 */
export function createMatchesTablePagination(
  pageSize = 10,
): TablePaginationConfig {
  return {
    defaultCurrent: 1,
    defaultPageSize: pageSize,
    showSizeChanger: true,
    pageSizeOptions: ['5', '10', '20', '50'],
    showTotal: (total) => `${total} partido${total === 1 ? '' : 's'}`,
    size: 'small',
  }
}
