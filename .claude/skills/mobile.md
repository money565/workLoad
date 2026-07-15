---
name: mobile
description: 移动端（钉钉 H5）页面开发指南 — 页面结构、后端接口、数据流、常见陷阱
---

# 移动端开发指南

移动端页面运行在钉钉 WebView 中，通过 Vite 代理访问后端 API。

## 页面结构

| 路由 | 文件 | 用途 |
|------|------|------|
| `/mobile` | `views/mobile/MobileHome.vue` | 主页（抢单 + 今日工作 + 我的） |
| `/mobile/scan` | `views/mobile/ScanWork.vue` | 扫码进入的工作拍照/巡检页 |
| `/mobile/home` | `views/mobile/Home.vue` | 旧版主页（仅显示欢迎） |

布局组件: `layouts/MobileLayout.vue` — 顶部标题栏 "细川量化工作" + `<router-view />`

### MobileHome 三标签结构

```
┌─────────────────────────────┐
│  抢单   │  今日工作  │  我的  │  ← TabBar
├─────────────────────────────┤
│ grabList (可抢工作)          │
│  - 从 arrangements 筛选      │
│  - status=0, ordertaker=null │
│  - 点击"接单" → takeOrder    │
├─────────────────────────────┤
│ myWorks (本期工作)           │
│  - source='assigned' 分配    │
│  - source='grabbed' 抢单     │
│  - takenWorkIds: 别人抢走的  │
├─────────────────────────────┤
│ 用户信息 + 薪资 + 说明       │
└─────────────────────────────┘
```

## 后端接口（移动端专用）

所有接口前缀 `/api/workLoad/`，开发时代理到 `https://www.cdxcwy.cn`。

### 1. MobileScan — 获取用户被分配的工作

```
GET /api/workLoad/mobileScan/<userid>
GET /api/workLoad/mobileScan/<userid>?wid=<work_id>
```

**返回逻辑**（`views.py` → `MobileScanView.get`）:

1. 通过 `userid` 查 `PublicMesgEmpList` 找到员工
2. 查 `StaffDispatch` 中该员工被分配到的岗位（status=0）
3. 遍历岗位 → 工作，检查每条工作的执行状态：
   - `work_cycle=0`（每日）：查当天是否有 `WorkExecution` 记录
   - `work_cycle=1`（每周）：查本周一~日范围内是否有记录
   - `work_cycle=2`（每月）：若当天 < `exec_time` 返回"还没到检查时间"；否则查 exec_time~今天

**返回字段**:
```typescript
{
  code: number
  result: Array<{
    work_id: number; work_name: string
    price: number; salary: number; feq: string; unit: string; number: number
    start_time: string | null; end_time: string | null
    work_type: number; work_cycle: number; exec_time: number
    position_name: string; project_name: string; project_id: number
    executor_id: number
    executed: boolean; msg: string | null
  }>
}
```

**⚠️ 注意**: 只返回通过 `StaffDispatch → Position → Works` 链路分配的工作，**不包含**用户从工作市场抢到的工作。

### 2. TakeOrder — 接单

```
POST /api/workLoad/takeOrder
Body: { userid: string, arr_id: number }
```

**后端逻辑**（`views.py` → `TakeOrderView.post`）:
1. 通过 `userid` 查找 `PublicMesgEmpList` 员工
2. `WorkArrangement.objects.filter(id=arr_id).update(ordertaker=emp, order_time=now, status=1)`
3. 返回 `{ code: 200, msg: 'ok' }`

**⚠️ 注意**: `arr_id` 是 `WorkArrangement.id`，不是 `WorkPlanWorks.id`。前端 `fetchGrabList` 中存在 ID 覆盖陷阱（见下文常见陷阱）。

### 3. Arrangements — 工作市场

```
GET    /api/workLoad/arrangements/<pid>     # 获取项目下所有排班
POST   /api/workLoad/arrangements/<pid>     # 创建排班（放入市场/指派）
PUT    /api/workLoad/arrangement/<pk>       # 更新排班（ordertaker, status, order_time）
DELETE /api/workLoad/arrangement/<pk>       # 删除排班
```

**返回字段**（GET）:
```typescript
{
  id: number           // WorkArrangement 主键
  work_id: number      // WorkPlanWorks 主键
  work_name: string
  work_day: number; work_month: number; work_week: number
  release_time: string | null
  ordertaker_id: number | null    // ⚠️ 这是 PublicMesgEmpList.id（员工表主键），不是 userid
  ordertaker_name: string
  order_time: string | null
  status: number       // 0=待接单, 1=已接单, 2=已完成
}
```

**⚠️ 关键问题**: `ordertaker_id` 是 `PublicMesgEmpList.id`（整数主键），而非 `userid`（钉钉用户ID字符串）。前端无法直接用 `userStore.userInfo.userid` 匹配，只能通过 `ordertaker_name === username` 做字符串匹配。

### 4. Executions — 工作执行记录

```
GET  /api/workLoad/executions/<pid>     # 获取项目下所有执行记录
POST /api/workLoad/executions/<pid>     # 创建执行记录（拍照提交）
PUT  /api/workLoad/execution/<pk>       # 更新执行记录（巡检）
```

**GET 返回**: 项目下**所有**执行记录（无用户/日期过滤），客户端自行筛选:
```typescript
{
  id: number; project_id: number
  work_plan_id: number; work_plan_name: string
  executor_id: number; executor_name: string
  image: string
  uploader_id: number; uploader_name: string
  upload_time: string | null
  check_result: number    // 0=未检查, 1=合格, 2=不合格
  remark: string
  check_image: string; check_time: string | null
  checker_id: number; checker_name: string
}
```

### 5. 其他接口

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `workPlans/<pid>` | 工作计划列表（price, unit, work_cycle 等） |
| GET | `empListByProject/<pid>` | 项目内员工列表 |
| GET | `standards/<pid>` | 工作标准（巡检用） |
| GET | `permission/<userid>` | 用户权限等级 |

## 关键数据流

### 抢单流程

```
fetchGrabList()
  ├── GET mobileScan/<userid> → 获取 project_id
  ├── GET arrangements/<pid> → 筛选 status=0 && !ordertaker_id
  └── GET workPlans/<pid> → 构建 planMap（price, unit, cycle 等）
       ↓
  用户点击"接单"
       ↓
  takeOrder(arrId)
  ├── POST /api/workLoad/takeOrder { userid, arr_id }
  └── 成功 → fetchGrabList() + fetchMyWorks()
```

### 今日工作数据合并

```
fetchMyWorks()
  ├── GET mobileScan/<userid> → scanWorks（分配的工作）
  ├── GET workPlans/<pid> → planMap
  ├── GET arrangements/<pid> → 拆分:
  │     ├── ordertaker_name === currentUser → grabbedWorks（本期过滤）
  │     └── 其他人 → takenWorkIds
  ├── GET executions/<pid> → checkExecution()
  └── myWorks = scanWorks + grabbedWorks（去重 + 排序）
```

## 常见陷阱

### 1. ID 覆盖问题

在 `fetchGrabList` 中合并 `planMap` 时，`planMap[a.work_id]` 包含工作计划自己的 `id` 字段，展开后会**覆盖** `a.id`（WorkArrangement 的主键）:

```typescript
// ❌ 错误 — planMap 的 id 覆盖了 arrangement 的 id
.map((a) => ({ ...a, ...planMap[a.work_id] }))

// ✅ 正确 — 显式提取需要的字段，排除 id
.map((a) => {
  const p = planMap[a.work_id] || ({} as typeof planMap[number])
  return { ...a, work_cycle: p.work_cycle, price: p.price, unit: p.unit, number: p.number }
})
```

### 2. ordertaker_id 身份匹配

`ordertaker_id` 是 `PublicMesgEmpList.id`（整数），不是 `userid`（字符串）。要判断是否为当前用户，只能通过 `ordertaker_name === userStore.userInfo.username` 做字符串匹配。这在同名用户场景下会出错。

### 3. 本期过滤

抢到的工作需要按 `work_cycle` 过滤到"本期":
- 每日（0）: `work_day === today`
- 每周（1）: `work_week === calcWorkWeek(today)`
- 每月（2）: `work_month === currentMonth`

周数计算 `calcWorkWeek` 需与后端保持一致（本年第一个星期一 = 第1周）。

### 4. 执行状态判断

抢到的工作没有通过 `MobileScanView` 返回（因为它不走 StaffDispatch），需要**客户端自行判断执行状态**。`checkExecution()` 函数复刻了后端 `MobileScanView.get` 的执行检查逻辑:
- 每日: 查当天 execution
- 每周: 查本周一~日 execution
- 每月: 先判断是否到达 exec_time，再查范围

### 5. fetch vs axios

移动端页面使用原生 `fetch()` 而非 axios 实例。这意味着:
- 不会自动附加 `Authorization` header（但 `/api/workLoad/` 路由不经过 ManagerAuthMiddleware，通常不需要）
- 需要手动 `JSON.parse(await resp.text())`
- 网络错误统一 catch 后静默或 toast

## 钉钉集成

登录流程见 `stores/counter.ts` → `useUserStore.login()`:
1. 检测钉钉环境（`/DingTalk/i.test(navigator.userAgent)`）
2. 非钉钉 → 从 localStorage 恢复缓存
3. 钉钉 → `authentication()` 获取签名 → `dd.config()` → `dd.ready` → `requestAuthCode` → `getUserBycode` 换取 JWT
4. 3秒超时兜底直接免登
