<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Rule } from 'ant-design-vue/es/form'
import { useAuthStore } from '@/stores/auth'
import { createTournament, fetchManagedTournaments } from '@/services/tournamentService'
import type { Tournament } from '@/types/tournament'

const auth = useAuthStore()
const router = useRouter()
const tournaments = ref<Tournament[]>([])
const assistedTournamentIds = ref<Set<string>>(new Set())
const loading = ref(true)
const creating = ref(false)
const showModal = ref(false)
const error = ref<string | null>(null)

const form = reactive({
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  visibility: 'public' as 'public' | 'private',
})

const rules: Record<string, Rule[]> = {
  name: [{ required: true, message: 'Ingresa el nombre del torneo' }],
}

const statusLabels: Record<Tournament['status'], string> = {
  draft: 'Borrador',
  active: 'Activo',
  finished: 'Finalizado',
}

const visibilityLabels: Record<Tournament['visibility'], string> = {
  public: 'Público',
  private: 'Privado',
}

function statusTagClass(status: Tournament['status']): string {
  return `page__tag--status-${status}`
}

function visibilityTagClass(visibility: Tournament['visibility']): string {
  return `page__tag--visibility-${visibility}`
}

async function load(): Promise<void> {
  if (!auth.profile) return
  loading.value = true
  try {
    tournaments.value = await fetchManagedTournaments(auth.profile.id)
    assistedTournamentIds.value = new Set(
      tournaments.value
        .filter((tournament) => tournament.organizer_id !== auth.profile?.id)
        .map((tournament) => tournament.id),
    )
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar torneos'
  } finally {
    loading.value = false
  }
}

function openModal(): void {
  error.value = null
  form.name = ''
  form.description = ''
  form.start_date = ''
  form.end_date = ''
  form.visibility = 'public'
  showModal.value = true
}

async function submit(): Promise<void> {
  error.value = null

  if (!auth.profile) {
    error.value = 'Sesión no disponible. Vuelve a iniciar sesión.'
    return
  }

  if (auth.profile.role !== 'organizer') {
    error.value = 'Tu cuenta es espectador. Regístrate como organizador para crear torneos.'
    return
  }

  creating.value = true
  try {
    const t = await createTournament(
      {
        name: form.name.trim(),
        description: form.description.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        visibility: form.visibility,
      },
      auth.profile.id,
    )
    showModal.value = false
    await router.push(`/tournaments/${t.id}`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo crear el torneo'
  } finally {
    creating.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <div class="page">
    <header class="page__header">
      <h1>Mis torneos</h1>
      <a-button v-if="auth.isOrganizer" type="primary" @click="openModal">Nuevo torneo</a-button>
    </header>

    <a-alert
      v-if="error && !showModal"
      type="error"
      :message="error"
      show-icon
      closable
      style="margin-bottom: 1rem"
      @close="error = null"
    />

    <a-spin :spinning="loading">
      <div v-if="tournaments.length" class="page__list">
        <router-link
          v-for="t in tournaments"
          :key="t.id"
          :to="`/tournaments/${t.id}`"
          class="page__card"
        >
          <h3>{{ t.name }}</h3>
          <div class="page__tags">
            <a-tag
              v-if="assistedTournamentIds.has(t.id)"
              class="page__tag--assistant"
            >
              Asistente
            </a-tag>
            <a-tag :class="statusTagClass(t.status)">
              {{ statusLabels[t.status] }}
            </a-tag>
            <a-tag :class="visibilityTagClass(t.visibility)">
              {{ visibilityLabels[t.visibility] }}
            </a-tag>
          </div>
        </router-link>
      </div>
      <a-empty
        v-else
        :description="auth.isOrganizer ? 'Aún no tienes torneos' : 'No estás asignado a ningún torneo'"
      />
    </a-spin>

    <a-modal v-model:open="showModal" title="Nuevo torneo" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="form" :rules="rules" @finish="submit">
        <a-form-item label="Nombre" name="name" :rules="rules.name">
          <a-input v-model:value="form.name" placeholder="Ej. Copa Verano 2026" />
        </a-form-item>
        <a-form-item label="Descripción">
          <a-textarea v-model:value="form.description" :rows="2" />
        </a-form-item>
        <a-form-item label="Inicio">
          <a-input v-model:value="form.start_date" type="date" />
        </a-form-item>
        <a-form-item label="Fin">
          <a-input v-model:value="form.end_date" type="date" />
        </a-form-item>
        <a-form-item label="Visibilidad">
          <a-select v-model:value="form.visibility">
            <a-select-option value="public">Público</a-select-option>
            <a-select-option value="private">Privado</a-select-option>
          </a-select>
        </a-form-item>

        <a-alert
          v-if="error"
          type="error"
          :message="error"
          show-icon
          style="margin-bottom: 1rem"
        />

        <a-button type="primary" html-type="submit" block :loading="creating">
          Crear torneo
        </a-button>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped lang="scss">
.page {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
}

.page__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;

  h1 { margin: 0; }
}

.page__list {
  display: grid;
  gap: 0.75rem;
}

.page__card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: inherit;
  text-decoration: none;

  h3 { margin: 0; flex: 1; }
}

.page__tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

:deep(.page__card .ant-tag) {
  margin: 0;
  border: 1px solid transparent;
  font-weight: 600;
  letter-spacing: 0.02em;
}

:deep(.page__tag--assistant) {
  background: rgba(179, 127, 235, 0.2);
  border-color: rgba(179, 127, 235, 0.45);
  color: #d3adf7;
}

:deep(.page__tag--status-draft) {
  background: rgba(0, 180, 216, 0.15);
  border-color: rgba(0, 180, 216, 0.4);
  color: #7dd3fc;
}

:deep(.page__tag--status-active) {
  background: rgba(82, 196, 26, 0.15);
  border-color: rgba(82, 196, 26, 0.4);
  color: #95de64;
}

:deep(.page__tag--status-finished) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(232, 237, 245, 0.8);
}

:deep(.page__tag--visibility-public) {
  background: rgba(0, 212, 255, 0.12);
  border-color: rgba(0, 212, 255, 0.35);
  color: #00d4ff;
}

:deep(.page__tag--visibility-private) {
  background: rgba(255, 107, 53, 0.12);
  border-color: rgba(255, 107, 53, 0.35);
  color: #ff9f6b;
}
</style>
