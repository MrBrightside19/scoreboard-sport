<script setup lang="ts">
import { useRoute } from 'vue-router'

defineProps<{
  matchId?: string
  copied: string | null
  tournamentContext: { tournamentId: string; court: string } | null
}>()

const emit = defineEmits<{
  copy: [type: 'live' | 'overlay' | 'board' | 'board-torneo']
}>()

const route = useRoute()
</script>

<template>
  <router-link
    v-if="tournamentContext"
    class="controls__link-tv-open"
    :to="{
      name: 'tournament-board',
      params: {
        tournamentId: tournamentContext.tournamentId,
        court: tournamentContext.court,
      },
      query: { matchId },
    }"
    target="_blank"
  >
    <a-button type="primary">Abrir TV local</a-button>
  </router-link>
  <router-link
    v-else
    class="controls__link-tv-open"
    :to="{
      name: 'board',
      query: {
        matchId,
        local: route.query.local,
        visit: route.query.visit,
        time: route.query.time,
      },
    }"
    target="_blank"
  >
    <a-button>Abrir TV local</a-button>
  </router-link>

  <a-button @click="emit('copy', 'live')">
    {{ copied === 'live' ? '¡Copiado!' : 'Copiar Live' }}
  </a-button>
  <a-button @click="emit('copy', 'overlay')">
    {{ copied === 'overlay' ? '¡Copiado!' : 'Copiar overlay' }}
  </a-button>
  <a-button
    class="controls__link-tv-copy"
    :class="{ 'controls__link-tv-copy--desktop': Boolean(tournamentContext) }"
    @click="emit('copy', tournamentContext ? 'board-torneo' : 'board')"
  >
    {{
      copied === 'board' || copied === 'board-torneo'
        ? '¡Copiado!'
        : tournamentContext
          ? 'Copiar TV remoto'
          : 'Copiar TV'
    }}
  </a-button>
  <router-link class="controls__link-switch-match" :to="{ name: 'mobile-mesa' }">
    <a-button>Otro partido</a-button>
  </router-link>
  <router-link class="controls__link-profile" :to="{ name: 'profile' }">
    <a-button>Perfil</a-button>
  </router-link>
</template>
