<script setup lang="ts">
import OverlayLogo from '@/overlay/graphics/OverlayLogo.vue'
import type { OverlayLineupModel, OverlayLineupPlayer } from '@/overlay/graphics/types'

defineProps<{
  model: OverlayLineupModel
}>()

function roleTag(player: OverlayLineupPlayer): string {
  if (player.role === 'goalkeeper') return 'ARQ'
  if (player.role === 'captain') return 'C'
  if (player.role === 'assistant_captain') return 'A'
  return ''
}
</script>

<template>
  <section
    class="og"
    :style="{
      '--og-local': model.local.color,
      '--og-visit': model.visit.color,
    }"
  >
    <article class="og__card">
      <header class="og__top">
        <h1 class="og__title">Nómina</h1>
        <p class="og__meta">{{ model.sportLabel }}</p>
      </header>

      <div class="og__columns">
        <div>
          <div class="og__col-head">
            <OverlayLogo
              :src="model.local.logo"
              :name="model.local.name"
              :color="model.local.color"
            />
            <h2 class="og__team-name">{{ model.local.name }}</h2>
          </div>
          <div class="og__roster">
            <div
              v-for="player in model.localRoster"
              :key="`l-${player.number}`"
              class="og__player"
            >
              <span class="og__num">{{ player.number }}</span>
              <span class="og__player-name">{{ player.name }}</span>
              <span v-if="roleTag(player)" class="og__role">{{ roleTag(player) }}</span>
            </div>
          </div>
        </div>

        <div>
          <div class="og__col-head">
            <OverlayLogo
              :src="model.visit.logo"
              :name="model.visit.name"
              :color="model.visit.color"
            />
            <h2 class="og__team-name">{{ model.visit.name }}</h2>
          </div>
          <div class="og__roster">
            <div
              v-for="player in model.visitRoster"
              :key="`v-${player.number}`"
              class="og__player"
            >
              <span class="og__num">{{ player.number }}</span>
              <span class="og__player-name">{{ player.name }}</span>
              <span v-if="roleTag(player)" class="og__role">{{ roleTag(player) }}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  </section>
</template>

<style lang="scss">
@use './overlay-graphic.scss';
</style>
