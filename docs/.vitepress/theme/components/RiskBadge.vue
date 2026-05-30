<template>
  <span
    :class="['risk-pill', `risk-pill-${level.toLowerCase()}`]"
    :aria-label="ariaLabel"
    :style="pillStyle"
  >
    <span
      v-if="!hideDot"
      class="risk-dot"
      aria-hidden="true"
      :style="dotStyle"
    />
    <span>{{ displayLabel }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  score: {
    type: Number,
    required: true
  },
  level: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  hideDot: {
    type: Boolean,
    default: false
  }
})

const isHigh = computed(() => props.level === 'HIGH')

const ariaLabel = computed(() => {
  if (props.label) return props.label
  return props.level === 'LOW'
    ? `Risco baixo, score ${props.score}`
    : props.level === 'MEDIUM'
    ? `Risco moderado, score ${props.score}`
    : `Risco alto, score ${props.score} — requer atenção`
})

const displayLabel = computed(() => {
  if (props.label) return `${props.label} · ${props.score}`
  return props.level === 'LOW'
    ? `Baixo risco · ${props.score}`
    : props.level === 'MEDIUM'
    ? `Risco moderado · ${props.score}`
    : `Alto risco · ${props.score}`
})

const pillStyle = computed(() => ({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: '500',
  padding: '3px 10px',
  gap: '6px',
  border: '0.5px solid var(--risk-border)',
  background: 'var(--risk-bg)',
  color: 'var(--risk-color)',
  animation: isHigh.value && !props.label ? 'risk-pill-pulse 2s infinite' : 'none',
  whiteSpace: 'nowrap',
  width: 'fit-content'
}))

const dotStyle = computed(() => ({
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: 'var(--risk-dot)',
  animation: isHigh.value && !props.label ? 'risk-dot-ping 1.5s ease-in-out infinite' : 'none',
  flexShrink: '0'
}))
</script>

<style scoped>
/* Light-mode tokens — faithful to @crmed/ui RiskPill.tsx */
.risk-pill-low {
  --risk-bg: #E1F5EE;
  --risk-color: #085041;
  --risk-border: #5DCAA5;
  --risk-dot: #0F6E56;
}
.risk-pill-medium {
  --risk-bg: #FAEEDA;
  --risk-color: #633806;
  --risk-border: #EF9F27;
  --risk-dot: #BA7517;
}
.risk-pill-high {
  --risk-bg: #FCEBEB;
  --risk-color: #791F1F;
  --risk-border: #E24B4A;
  --risk-dot: #A32D2D;
}

/* Dark-mode tokens */
:root.dark .risk-pill-low {
  --risk-bg: #04342C;
  --risk-color: #9FE1CB;
  --risk-border: #1D9E75;
  --risk-dot: #1D9E75;
}
:root.dark .risk-pill-medium {
  --risk-bg: #412402;
  --risk-color: #FAC775;
  --risk-border: #BA7517;
  --risk-dot: #BA7517;
}
:root.dark .risk-pill-high {
  --risk-bg: #501313;
  --risk-color: #F7C1C1;
  --risk-border: #A32D2D;
  --risk-dot: #A32D2D;
}

@keyframes risk-dot-ping {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes risk-pill-pulse {
  0% { box-shadow: 0 0 0 0 rgba(226,75,74,0.35); }
  70% { box-shadow: 0 0 0 6px rgba(226,75,74,0); }
  100% { box-shadow: 0 0 0 0 rgba(226,75,74,0); }
}

@media (prefers-reduced-motion: reduce) {
  .risk-pill, .risk-dot {
    animation: none !important;
  }
}
</style>
