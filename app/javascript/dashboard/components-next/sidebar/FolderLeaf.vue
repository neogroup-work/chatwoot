<script setup>
const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
  count: {
    type: Number,
    default: null,
  },
});

// Display at most 99+, keep it tight
const displayCount = count => {
  if (count === null || count === undefined) return null;
  return count > 99 ? '99+' : String(count);
};
</script>

<template>
  <div class="flex-1 truncate min-w-0">{{ label }}</div>
  <span
    v-if="displayCount(count) !== null"
    class="ml-auto flex-shrink-0 text-xxs font-medium tabular-nums px-1.5 py-0.5 rounded-full"
    :class="
      active
        ? 'bg-n-blue-5/30 text-n-blue-11'
        : 'bg-n-slate-3 text-n-slate-10'
    "
  >
    {{ displayCount(count) }}
  </span>
</template>
