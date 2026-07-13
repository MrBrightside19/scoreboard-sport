<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { formatSecondsToTime, normalizeGameTime } from '@/utils/clock'

const props = withDefaults(
  defineProps<{
    value: string
    disabled?: boolean
    id?: string
    placeholder?: string
  }>(),
  {
    disabled: false,
    placeholder: 'mm:ss',
  },
)

const emit = defineEmits<{
  'update:value': [string]
  focus: []
  blur: []
  enter: []
}>()

type Segment = 'minutes' | 'seconds'

const inputRef = ref<{ $el?: HTMLElement } | HTMLInputElement | null>(null)
const focused = ref(false)
const segment = ref<Segment>('minutes')
const digitPos = ref(0)
const minutes = ref('00')
const seconds = ref('00')

const display = computed(() => `${minutes.value}:${seconds.value}`)

function splitTime(raw: string): { minutes: string; seconds: string } {
  const normalized = normalizeGameTime(raw || '00:00')
  const [mins = '00', secs = '00'] = normalized.split(':')
  return {
    minutes: mins.padStart(2, '0').slice(-2),
    seconds: Math.min(59, Number.parseInt(secs, 10) || 0)
      .toString()
      .padStart(2, '0'),
  }
}

function syncFromProp(raw: string): void {
  const parts = splitTime(raw)
  minutes.value = parts.minutes
  seconds.value = parts.seconds
}

watch(
  () => props.value,
  (next) => {
    if (!focused.value) syncFromProp(next)
  },
  { immediate: true },
)

function getNativeInput(): HTMLInputElement | null {
  const root = inputRef.value
  if (!root) return null
  if (root instanceof HTMLInputElement) return root
  const el = (root as { $el?: HTMLElement }).$el
  if (!el) return null
  if (el instanceof HTMLInputElement) return el
  return el.querySelector('input')
}

function selectSegment(next: Segment, pos = 0): void {
  segment.value = next
  digitPos.value = pos
  void nextTick(() => {
    const input = getNativeInput()
    if (!input) return
    if (next === 'minutes') input.setSelectionRange(0, 2)
    else input.setSelectionRange(3, 5)
  })
}

function emitCurrent(): void {
  const secs = Math.min(59, Number.parseInt(seconds.value, 10) || 0)
  seconds.value = String(secs).padStart(2, '0')
  const mins = Math.max(0, Number.parseInt(minutes.value, 10) || 0)
  minutes.value = String(mins).padStart(2, '0').slice(-2)
  emit('update:value', `${minutes.value}:${seconds.value}`)
}

function applyDigit(digit: string): void {
  if (segment.value === 'minutes') {
    const chars = minutes.value.padStart(2, '0').slice(-2).split('')
    chars[digitPos.value] = digit
    minutes.value = chars.join('')
    digitPos.value += 1
    emitCurrent()
    if (digitPos.value >= 2) selectSegment('seconds', 0)
    else selectSegment('minutes', digitPos.value)
    return
  }

  const chars = seconds.value.padStart(2, '0').slice(-2).split('')
  chars[digitPos.value] = digit
  let next = chars.join('')
  if (digitPos.value === 0 && Number.parseInt(digit, 10) > 5) {
    next = `0${digit}`
    seconds.value = next
    emitCurrent()
    selectSegment('seconds', 1)
    return
  }
  const asNum = Number.parseInt(next, 10)
  if (asNum > 59) next = '59'
  seconds.value = next.padStart(2, '0').slice(-2)
  digitPos.value = Math.min(digitPos.value + 1, 1)
  emitCurrent()
  selectSegment('seconds', digitPos.value)
}

function clearSegment(): void {
  if (segment.value === 'minutes') {
    minutes.value = '00'
  } else {
    seconds.value = '00'
  }
  digitPos.value = 0
  emitCurrent()
  selectSegment(segment.value, 0)
}

function onKeyDown(event: KeyboardEvent): void {
  if (props.disabled) return

  if (event.key === 'Enter') {
    event.preventDefault()
    emitCurrent()
    emit('enter')
    return
  }

  if (event.key === 'Tab') {
    if (segment.value === 'minutes' && !event.shiftKey) {
      event.preventDefault()
      selectSegment('seconds', 0)
      return
    }
    if (segment.value === 'seconds' && event.shiftKey) {
      event.preventDefault()
      selectSegment('minutes', 0)
      return
    }
    emitCurrent()
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    selectSegment('seconds', 0)
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    selectSegment('minutes', 0)
    return
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault()
    clearSegment()
    return
  }

  if (/^\d$/.test(event.key)) {
    event.preventDefault()
    applyDigit(event.key)
    return
  }

  // Bloquear letras y otros caracteres imprimibles (salvo atajos).
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
  }
}

function onClick(): void {
  if (props.disabled) return
  const input = getNativeInput()
  const caret = input?.selectionStart ?? 0
  selectSegment(caret <= 2 ? 'minutes' : 'seconds', 0)
}

function onFocus(): void {
  focused.value = true
  syncFromProp(props.value)
  emit('focus')
  selectSegment('minutes', 0)
}

function onBlur(): void {
  focused.value = false
  emitCurrent()
  const normalized = formatSecondsToTime(
    (Number.parseInt(minutes.value, 10) || 0) * 60 +
      Math.min(59, Number.parseInt(seconds.value, 10) || 0),
  )
  const parts = splitTime(normalized)
  minutes.value = parts.minutes
  seconds.value = parts.seconds
  emit('update:value', normalized)
  emit('blur')
}

function onPaste(event: ClipboardEvent): void {
  event.preventDefault()
  if (props.disabled) return
  const text = event.clipboardData?.getData('text') ?? ''
  const digits = text.replace(/\D/g, '').slice(0, 4)
  if (!digits) return
  const padded = digits.padStart(4, '0').slice(-4)
  minutes.value = padded.slice(0, 2)
  seconds.value = String(
    Math.min(59, Number.parseInt(padded.slice(2, 4), 10) || 0),
  ).padStart(2, '0')
  emitCurrent()
  selectSegment('seconds', 1)
}
</script>

<template>
  <a-input
    :id="id"
    ref="inputRef"
    :value="display"
    :disabled="disabled"
    :placeholder="placeholder"
    inputmode="numeric"
    autocomplete="off"
    spellcheck="false"
    class="time-input"
    @keydown="onKeyDown"
    @focus="onFocus"
    @blur="onBlur"
    @click="onClick"
    @paste="onPaste"
  />
</template>

<style scoped>
.time-input {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
</style>
