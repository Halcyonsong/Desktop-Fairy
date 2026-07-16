<template>
  <div class="app-shell">
    <aside class="app-shell__sidebar">
      <slot name="sidebar" />
    </aside>

    <main class="app-shell__main">
      <slot name="main" />
    </main>
  </div>
</template>
