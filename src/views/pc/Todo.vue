<script setup lang="ts"></script>

<template>
  <div class="flex flex-col h-full">
    <a-page-header class="shrink-0" title="待办事项" @back="() => $router.back()" />
    <a-card class="flex-1 flex-center">
      <a-empty description="待办事项功能开发中" />
    </a-card>
  </div>
</template>
