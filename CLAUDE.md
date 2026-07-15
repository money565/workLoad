# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

**Always use `pnpm`** — this is a pnpm workspace. npm/yarn will ignore workspace overrides.

All Vue packages are pinned to the **beta** channel via `pnpm-workspace.yaml` overrides. Do not unpin or change these without explicit instruction.

## Commands

| Task | Command |
|------|---------|
| Dev server (hot reload) | `pnpm dev` |
| Type-check | `pnpm type-check` |
| Production build | `pnpm build` |
| Unit tests (Vitest) | `pnpm test:unit` |
| Single unit test file | `pnpm test:unit -- path/to/test.spec.ts` |
| E2E tests (Playwright) | `pnpm test:e2e` |
| E2E — Chromium only | `pnpm test:e2e --project=chromium` |
| E2E — single file | `pnpm test:e2e tests/example.spec.ts` |
| E2E — debug mode | `pnpm test:e2e --debug` |
| Lint (oxlint + ESLint) | `pnpm lint` |
| Format | `pnpm format` |

First-time E2E setup: `npx playwright install` to download browsers.

## Tech Stack

- **Framework**: Vue 3 (Composition API with `<script setup>`)
- **Build**: Vite 8
- **Language**: TypeScript 6 (strict, with `noUncheckedIndexedAccess`)
- **State management**: Pinia 3 — use setup-store syntax (composition API inside `defineStore`)
- **Routing**: Vue Router 5 (HTML5 history mode)
- **Unit testing**: Vitest 4 + jsdom + `@vue/test-utils`
- **E2E testing**: Playwright (chromium, firefox, webkit)
- **Linting**: oxlint (fast, correctness-focused) + ESLint (Vue/TS rules). Run both via `pnpm lint`.
- **UI library**: Ant Design Vue 4 — components auto-imported via `unplugin-vue-components` resolver
- **CSS engine**: UnoCSS — atomic CSS with `presetUno` + `presetAttributify` (支持属性化写法)。配置文件 `uno.config.ts`

## Architecture

### Path Aliases

`@` maps to `./src` in both Vite and TypeScript.

### Component Auto-Import (unplugin-vue-components)

Components placed in `src/components/` are **automatically registered** — no need to `import` them in `<script setup>`. Subdirectory names become part of the component name (e.g. `src/components/foo/Bar.vue` → `<FooBar />`). TypeScript declarations are generated to `src/components.d.ts`.

### API Auto-Import (unplugin-auto-import)

Vue Composition API (`ref`, `computed`, `watch`, etc.), Vue Router (`useRouter`, `useRoute`), and Pinia (`defineStore`, `storeToRefs`, `acceptHMRUpdate`) are **auto-imported** — no need to write `import { ref } from 'vue'`. TypeScript declarations are generated to `src/auto-imports.d.ts`.

Both generated `.d.ts` files are committed to the repo. Run `pnpm dev` once to regenerate them after adding new dependencies.

### Application Bootstrap (`src/main.ts`)

The app is created with `createApp`, then `createPinia()` and the router are installed before mounting to `#app`.

### HTTP Client (`src/axios/`)

Axios 实例 (`request.ts`) 带请求/响应拦截器：
- **请求拦截器**: 自动读取 localStorage 中的 JWT token 附加到 `Authorization: Bearer` 头
- **响应拦截器**: 统一处理 code !== 200、401（清除过期 token）、500 等错误

后端接口分两个文件：
- `interface.ts` — 通用接口（钉钉鉴权、人员搜索、部门树、COS 令牌等）
- `interfaceLogin.ts` — 登录相关（免登、UserByCode、刷新员工/部门列表）

开发时 Vite 会将 `/publicMesg` 和 `/api` 请求代理到 `https://www.cdxcwy.cn`。

### State Management (`src/stores/`)

Pinia setup stores only. The `useCounterStore` in `counter.ts` is the canonical pattern — use `defineStore(id, () => { ... })` returning reactive state and methods.

### Routing (`src/router/index.ts`)

PC 和移动端分离路由：
- `/pc` → `PcLayout` → `views/pc/` 下各页面
- `/mobile` → `MobileLayout` → `views/mobile/` 下各页面
- 默认 `/` 跳转 `/pc`

### Directory Structure

```
src/
├── axios/              # HTTP 客户端（拦截器 + 接口）
├── components/
│   ├── pc/             # PC 端组件
│   └── mobile/         # 移动端组件
├── layouts/
│   ├── PcLayout.vue    # PC 布局（侧边栏 + 面包屑）
│   └── MobileLayout.vue # 移动端布局（顶部标题栏）
├── views/
│   ├── pc/             # PC 端页面
│   └── mobile/         # 移动端页面（钉钉 H5）
├── stores/             # Pinia stores
├── router/             # Vue Router
├── plugins/            # 插件（vConsole 等）
└── main.ts             # 入口

### Testing

- **Unit tests** live in `src/**/__tests__/*` and use `@vue/test-utils` `mount()`. The jsdom environment simulates a browser.
- **E2E tests** live in `e2e/`. Playwright auto-starts the dev server (port 5173 locally, port 4173 on CI) and reuses an existing server when available.

### CI vs Local

Detect CI via `process.env.CI`. On CI: Playwright runs headless against the preview server with 2 retries and no parallelism. Locally: headed, dev server, no retries.
