<script setup lang="ts">
import type { StandingRow } from '@/types/tournament'

defineProps<{
  standings: StandingRow[]
}>()

const columns = [
  { title: '#', key: 'rank', width: 48 },
  { title: 'Equipo', dataIndex: 'team', key: 'team' },
  { title: 'PJ', dataIndex: 'played', key: 'played', width: 56 },
  { title: 'G', dataIndex: 'wins', key: 'wins', width: 48 },
  { title: 'E', dataIndex: 'draws', key: 'draws', width: 48 },
  { title: 'P', dataIndex: 'losses', key: 'losses', width: 48 },
  { title: 'GF', dataIndex: 'goalsFor', key: 'goalsFor', width: 56 },
  { title: 'GC', dataIndex: 'goalsAgainst', key: 'goalsAgainst', width: 56 },
  { title: 'DG', dataIndex: 'goalDiff', key: 'goalDiff', width: 56 },
  { title: 'Pts', dataIndex: 'points', key: 'points', width: 64 },
]
</script>

<template>
  <div class="standings-wrap">
    <a-table
      :columns="columns"
      :data-source="standings.map((row, i) => ({ ...row, key: row.team, rank: i + 1 }))"
      :pagination="false"
      size="small"
      bordered
      :scroll="{ x: 640 }"
      table-layout="fixed"
    />
  </div>
</template>

<style scoped>
.standings-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
