<script setup lang="ts">
import OverlayLogo from '@/overlay/graphics/OverlayLogo.vue'
import OverlayPingPongLane from '@/overlay/graphics/OverlayPingPongLane.vue'
import type { OverlayBreakModel, OverlayEventRow } from '@/overlay/graphics/types'

defineProps<{
  model: OverlayBreakModel
}>()

const scoringTitle = (sport: OverlayBreakModel['sport']) =>
  sport === 'basketball' ? 'Anotaciones' : 'Goles'

function eventLabel(row: OverlayEventRow): string {
  const num = row.number ? `#${row.number} ` : ''
  return `${num}${row.player}`
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
        <h1 class="og__title">{{ model.heading }}</h1>
        <p class="og__meta">{{ model.sportLabel }}</p>
      </header>

      <div class="og__score-row">
        <div class="og__team">
          <OverlayLogo
            :src="model.local.logo"
            :name="model.local.name"
            :color="model.local.color"
          />
          <h2 class="og__team-name">{{ model.local.name }}</h2>
        </div>
        <div class="og__score">
          <span>{{ model.local.score }}</span>
          <em>—</em>
          <span>{{ model.visit.score }}</span>
        </div>
        <div class="og__team og__team--visit">
          <h2 class="og__team-name">{{ model.visit.name }}</h2>
          <OverlayLogo
            :src="model.visit.logo"
            :name="model.visit.name"
            :color="model.visit.color"
          />
        </div>
      </div>

      <div class="og__stats">
        <div v-for="stat in model.stats" :key="stat.key" class="og__stat">
          <span />
          <span class="og__stat-value og__stat-value--local">{{ stat.local }}</span>
          <span class="og__stat-label">{{ stat.label }}</span>
          <span class="og__stat-value og__stat-value--visit">{{ stat.visit }}</span>
          <span />
        </div>
      </div>

      <div class="og__feeds">
        <section class="og__block">
          <h3 class="og__block-title">{{ scoringTitle(model.sport) }}</h3>
          <OverlayPingPongLane :source="model.scorers">
            <div class="og__split">
              <div>
                <p v-if="!model.scorers.local.length" class="og__empty">—</p>
                <p
                  v-for="(row, index) in model.scorers.local"
                  :key="`sl-${index}`"
                  class="og__event"
                >
                  <span class="og__minute">{{ row.minute }}</span>
                  <span class="og__event-name">{{ eventLabel(row) }}</span>
                  <span v-if="row.extra" class="og__extra">{{ row.extra }}</span>
                </p>
              </div>
              <div class="og__split-col--visit">
                <p v-if="!model.scorers.visit.length" class="og__empty">—</p>
                <p
                  v-for="(row, index) in model.scorers.visit"
                  :key="`sv-${index}`"
                  class="og__event og__event--visit"
                >
                  <span v-if="row.extra" class="og__extra">{{ row.extra }}</span>
                  <span class="og__event-name">{{ eventLabel(row) }}</span>
                  <span class="og__minute">{{ row.minute }}</span>
                </p>
              </div>
            </div>
          </OverlayPingPongLane>
        </section>

        <section v-if="model.cards" class="og__block">
          <h3 class="og__block-title">Tarjetas</h3>
          <OverlayPingPongLane :source="model.cards">
            <div class="og__split">
              <div>
                <p v-if="!model.cards.local.length" class="og__empty">—</p>
                <p
                  v-for="(row, index) in model.cards.local"
                  :key="`cl-${index}`"
                  class="og__event"
                >
                  <span class="og__chip" :class="`og__chip--${row.kind}`" />
                  <span class="og__minute">{{ row.minute }}</span>
                  <span class="og__event-name">{{ eventLabel(row) }}</span>
                </p>
              </div>
              <div class="og__split-col--visit">
                <p v-if="!model.cards.visit.length" class="og__empty">—</p>
                <p
                  v-for="(row, index) in model.cards.visit"
                  :key="`cv-${index}`"
                  class="og__event og__event--visit"
                >
                  <span class="og__event-name">{{ eventLabel(row) }}</span>
                  <span class="og__minute">{{ row.minute }}</span>
                  <span class="og__chip" :class="`og__chip--${row.kind}`" />
                </p>
              </div>
            </div>
          </OverlayPingPongLane>
        </section>

        <section v-if="model.fouls" class="og__block">
          <h3 class="og__block-title">Faltas</h3>
          <OverlayPingPongLane :source="model.fouls">
            <div class="og__split">
              <div>
                <p v-if="!model.fouls.local.length" class="og__empty">—</p>
                <p
                  v-for="(row, index) in model.fouls.local"
                  :key="`fl-${index}`"
                  class="og__event"
                >
                  <span class="og__minute">{{ row.minute }}</span>
                  <span class="og__event-name">{{ eventLabel(row) }}</span>
                  <span v-if="row.extra" class="og__extra">{{ row.extra }}</span>
                </p>
              </div>
              <div class="og__split-col--visit">
                <p v-if="!model.fouls.visit.length" class="og__empty">—</p>
                <p
                  v-for="(row, index) in model.fouls.visit"
                  :key="`fv-${index}`"
                  class="og__event og__event--visit"
                >
                  <span v-if="row.extra" class="og__extra">{{ row.extra }}</span>
                  <span class="og__event-name">{{ eventLabel(row) }}</span>
                  <span class="og__minute">{{ row.minute }}</span>
                </p>
              </div>
            </div>
          </OverlayPingPongLane>
        </section>
      </div>
    </article>
  </section>
</template>

<style lang="scss">
@use './overlay-graphic.scss';
</style>
