<script setup lang="ts">
import { onMounted, ref } from 'vue'

// Mounts the Scalar API reference over the bundled spec. Client-only: it reads
// `/openapi.json` from the site's static assets at runtime. The "send request"
// button is hidden on purpose — the docs must never fire calls at the live API,
// where a payment attempt would prompt a real phone and a booking would hold a
// real slot.
const el = ref<HTMLElement | null>(null)

onMounted(async () => {
  const { createApiReference } = await import('@scalar/api-reference')
  createApiReference(el.value!, {
    url: '/openapi.json',
    hideTestRequestButton: true,
    hideDownloadButton: false,
    layout: 'modern',
  })
})
</script>

<template>
  <div ref="el" class="bookly-api-reference" />
</template>

<style>
/* Let the reference use the full width of the page. */
.bookly-api-reference {
  margin: 0 -24px;
}
</style>
