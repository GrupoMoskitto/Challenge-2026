<template>
  <span :class="['env-badge', required ? 'required' : 'optional']">
    <svg v-if="required" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
    <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
    {{ required ? 'Obrigatório' : 'Opcional' }}
  </span>
</template>

<script setup>
defineProps({
  required: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.env-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 6px;
  border-radius: 6px;
  font-size: 11px;
  font-family: var(--vp-font-family-base);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  line-height: 1;
}

.icon {
  margin-top: -1px;
}

.required {
  background-color: hsla(142, 71%, 45%, 0.1);
  color: hsl(142, 71%, 35%);
  border: 1px solid hsla(142, 71%, 45%, 0.2);
}

.optional {
  background-color: hsla(0, 71%, 45%, 0.1);
  color: hsl(0, 71%, 35%);
  border: 1px solid hsla(0, 71%, 45%, 0.2);
}

:root.dark .required {
  background-color: hsla(142, 71%, 45%, 0.15);
  color: hsl(142, 71%, 60%);
  border-color: hsla(142, 71%, 45%, 0.3);
}

:root.dark .optional {
  background-color: hsla(0, 71%, 45%, 0.15);
  color: hsl(0, 71%, 65%);
  border-color: hsla(0, 71%, 45%, 0.3);
}
</style>
