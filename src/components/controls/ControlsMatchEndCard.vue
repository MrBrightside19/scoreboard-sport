<script setup lang="ts">
defineProps<{
  tournamentContext: { tournamentId: string; court: string } | null
  hasNextMatch: boolean
  advancing: boolean
  finishing: boolean
  advanceError?: string | null
}>()

const emit = defineEmits<{
  next: []
  finish: []
}>()
</script>

<template>
  <a-card
    v-if="!tournamentContext"
    title="Partido libre"
    class="controls__card controls__card--wide"
  >
    <a-alert
      v-if="advanceError"
      type="error"
      :message="advanceError"
      show-icon
      style="margin-bottom: 0.75rem"
    />
    <p class="controls__tournament-hint">
      Solo puede haber un partido libre a la vez. Al finalizarlo podrás crear otro desde el menú.
    </p>
    <a-popconfirm
      title="¿Finalizar este partido? Dejará de aparecer en En vivo."
      ok-text="Finalizar"
      cancel-text="Cancelar"
      :disabled="finishing"
      @confirm="emit('finish')"
    >
      <a-button block danger :loading="finishing">
        Finalizar partido
      </a-button>
    </a-popconfirm>
  </a-card>

  <a-card
    v-else
    title="Torneo"
    class="controls__card controls__card--wide"
  >
    <p class="controls__tournament-meta">
      Cancha {{ tournamentContext.court }}
    </p>
    <p class="controls__tournament-hint controls__tournament-hint--info">
      El enlace <strong>TV remoto</strong> es fijo para esta cancha.
      El marcador TV se actualiza al instante si está en el mismo navegador;
      al pasar de partido cambia solo sin cerrar la pestaña.
      Los enlaces OBS y Live están en Configuración del torneo.
    </p>
    <a-alert
      v-if="advanceError"
      type="error"
      :message="advanceError"
      show-icon
      style="margin-bottom: 0.75rem"
    />
    <a-popconfirm
      title="¿Finalizar este partido e iniciar el siguiente de la cancha?"
      ok-text="Sí, continuar"
      cancel-text="Cancelar"
      :disabled="!hasNextMatch || advancing || finishing"
      @confirm="emit('next')"
    >
      <a-button
        type="primary"
        block
        :loading="advancing"
        :disabled="!hasNextMatch || finishing"
      >
        Siguiente partido
      </a-button>
    </a-popconfirm>
    <a-popconfirm
      title="¿Finalizar este partido? Dejará de aparecer en En vivo."
      ok-text="Finalizar"
      cancel-text="Cancelar"
      :disabled="advancing || finishing"
      @confirm="emit('finish')"
    >
      <a-button
        block
        danger
        :loading="finishing"
        :disabled="advancing"
        style="margin-top: 0.5rem"
      >
        Finalizar partido
      </a-button>
    </a-popconfirm>
    <p v-if="!hasNextMatch" class="controls__tournament-hint">
      No quedan partidos programados en esta cancha. Usa Finalizar partido para cerrarlo.
    </p>
  </a-card>
</template>
