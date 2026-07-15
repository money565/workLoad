# 细川量化工作 (WorkLoad)

基于 Vue 3 + Vite + TypeScript 的物业量化工作管理平台，支持 PC 管理端和钉钉 H5 移动端。

## 功能模块

### PC 管理端
- **人员管理** — 员工列表、部门树、权限分配
- **工作和岗位** — 工作计划、工作标准、岗位管理、人员调配
- **项目运行** — 今日任务、本周计划、本月计划、本月巡检、工作市场、计件核算
- **数据查看** — 各数据表原始数据浏览
- **设置** — 背景色、字体大小、文本可选性

### 移动端（钉钉 H5）
- **员工端** — 今日工作、抢单、语音播报、扫码拍照、巡检
- **管理端** — 人员管理、工作和岗位、项目运行、工作市场、本月数据

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3 (Composition API + script setup) |
| 构建 | Vite 8 |
| 语言 | TypeScript 6 |
| 状态管理 | Pinia 3 |
| 路由 | Vue Router 5 |
| UI 库 | Ant Design Vue 4 + UnoCSS |
| HTTP | Axios (JWT 拦截器) |
| 测试 | Vitest + Playwright |
| 包管理 | pnpm |

## 项目结构

```
src/
├── axios/          # HTTP 客户端（拦截器 + 接口定义）
├── components/     # 组件（pc/ mobile/ 自动注册）
├── composables/    # 组合式函数（useUpload, useTheme）
├── layouts/        # 布局（PcLayout, MobileLayout）
├── views/          # 页面
│   ├── pc/         # PC 端页面
│   └── mobile/     # 移动端页面
│       ├── MobileHome.vue     # 入口（权限路由）
│       ├── MobileEmployee.vue # 员工主页
│       ├── ScanWork.vue       # 扫码工作/巡检
│       └── admin/             # 管理端模块
├── stores/         # Pinia 状态管理
├── router/         # Vue Router 配置
└── plugins/        # 插件（vConsole 等）
```

## 开发

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动开发服务器
pnpm type-check       # 类型检查
pnpm build            # 生产构建
pnpm test:unit        # 单元测试
pnpm test:e2e         # E2E 测试
pnpm lint             # 代码检查
```

## 后端

后端基于 Django + uWSGI + Celery，部署在 Ubuntu 22.04。通过 Vite 代理转发 API 请求。

相关技能文档见 `.claude/skills/` 目录。
