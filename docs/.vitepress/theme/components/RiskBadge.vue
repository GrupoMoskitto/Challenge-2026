<template>
  <span :class="['risk-badge', level.toLowerCase()]">
    <span class="score">{{ score }}</span>
    <span class="label">{{ label || level }}</span>
  </span>
</template>

<script setup>
defineProps({
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
  }
})
</script>

<style scoped>
.risk-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 9999px;
  font-weight: 800;
  font-size: 0.75rem;
  border: 1px solid;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.score {
  background: var(--vp-c-bg);
  padding: 1px 4px;
  border-radius: 4px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
  line-height: 1;
}

.high {
  background: hsla(0, 84%, 60%, 0.15);
  color: hsl(0, 84%, 45%);
  border-color: hsla(0, 84%, 60%, 0.3);
}
:root.dark .high {
  color: hsl(0, 84%, 75%);
}

.medium {
  background: hsla(38, 92%, 50%, 0.15);
  color: hsl(38, 92%, 40%);
  border-color: hsla(38, 92%, 50%, 0.3);
}
:root.dark .medium {
  color: hsl(38, 92%, 65%);
}

.low {
  background: hsla(142, 71%, 45%, 0.15);
  color: hsl(142, 71%, 35%);
  border-color: hsla(142, 71%, 45%, 0.3);
}
:root.dark .low {
  color: hsl(142, 71%, 60%);
}
</style>
