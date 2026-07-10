<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { Rule } from 'ant-design-vue/es/form'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{
  success: []
}>()

const auth = useAuthStore()
const mode = ref<'login' | 'register'>('login')
const form = reactive({
  email: '',
  password: '',
  displayName: '',
  asOrganizer: false,
})
const submitting = ref(false)

const rules: Record<string, Rule[]> = {
  email: [
    { required: true, message: 'Ingresa tu email' },
    { type: 'email', message: 'Email inválido' },
  ],
  password: [
    { required: true, message: 'Ingresa tu contraseña' },
    { min: 6, message: 'Mínimo 6 caracteres' },
  ],
  displayName: [{ required: true, message: 'Ingresa tu nombre' }],
}

async function submit(): Promise<void> {
  submitting.value = true
  auth.error = null
  auth.info = null
  try {
    if (mode.value === 'login') {
      await auth.login(form.email, form.password)
      emit('success')
    } else {
      const loggedIn = await auth.register(
        form.email,
        form.password,
        form.displayName,
        form.asOrganizer,
      )
      if (loggedIn) emit('success')
    }
  } catch {
    // El store ya guarda auth.error
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <a-form layout="vertical" :model="form" :rules="rules" @finish="submit">
    <a-segmented
      v-model:value="mode"
      block
      :options="[
        { label: 'Iniciar sesión', value: 'login' },
        { label: 'Registrarse', value: 'register' },
      ]"
      style="margin-bottom: 1rem"
    />

    <a-form-item
      v-if="mode === 'register'"
      label="Nombre"
      name="displayName"
      :rules="rules.displayName"
    >
      <a-input v-model:value="form.displayName" placeholder="Tu nombre" />
    </a-form-item>

    <a-form-item label="Email" name="email" :rules="rules.email">
      <a-input v-model:value="form.email" type="email" placeholder="tu@email.com" />
    </a-form-item>

    <a-form-item label="Contraseña" name="password" :rules="rules.password">
      <a-input-password v-model:value="form.password" placeholder="Mínimo 6 caracteres" />
    </a-form-item>

    <a-form-item v-if="mode === 'register'">
      <a-checkbox v-model:checked="form.asOrganizer">
        Registrarme como organizador
      </a-checkbox>
    </a-form-item>

    <a-alert
      v-if="auth.info"
      type="info"
      :message="auth.info"
      show-icon
      style="margin-bottom: 1rem"
    />

    <a-alert
      v-if="auth.error"
      type="error"
      :message="auth.error"
      show-icon
      style="margin-bottom: 1rem"
    />

    <a-button type="primary" html-type="submit" block :loading="submitting">
      {{ mode === 'login' ? 'Entrar' : 'Crear cuenta' }}
    </a-button>
  </a-form>
</template>
