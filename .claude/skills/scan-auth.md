---
name: scan-auth
description: 扫码后判断员工是否有权执行该工作的完整逻辑
---

# 扫码工作权限判断

## 输入

- `group_key`: 二维码中的工作组标识
- `userid`: 当前扫码员工的钉钉 userid

## 流程

### Step 1：周期匹配

根据 `group_key` 查询 `WorkPlanWorks`，拿到该组**所有**工作，判断当前日期/时间是否在工作周期内：

| work_cycle | 当前周期匹配条件 |
|------------|-----------------|
| 0 每日 | 当前时间在哪个 `start_time` 区间内，取区间左边界 |
| 1 每周 | 当前星期几 >= `exec_time`，取最大的那个 |
| 2 每月 | 当前日期 >= `exec_time`，取最大的那个 |

**返回**：周期内匹配到的**第一个**工作记录。

> 如果当前时间不在任何周期内，返回空 + 所有时间槽供前端展示。

### Step 2：检查是否被抢（WorkArrangement）

用匹配到的工作 `id` 和 `work_cycle` 去 `WorkArrangement` 表查找：

- `work_id` = 该工作的 id（或同 group_key 下所有工作的 id）
- 检查 `WorkArrangement` 的周期字段是否匹配当前周期：
  - `work_cycle=0` → `work_day == 今天`
  - `work_cycle=1` → `work_week == 本周`
  - `work_cycle=2` → `work_month == 本月`
- `status = 1`（已接单）

### Step 3：分情况处理

#### 情况 A：已被抢（WorkArrangement 有记录）

**A1** — `ordertaker` 的用户 `userid` **等于**扫码员工的 `userid`

→ ✅ **返回该工作**（员工抢到了这个工作）

**A2** — `ordertaker` 的 `userid` **不等于**扫码员工的 `userid`

→ 查 `StaffDispatch` 链（`StaffDispatch → Position → Works`），看该工作是否安排给了扫码员工：

  - **A2a** — 安排了 → 返回 `"该工作已经被额外安排"`
  - **A2b** — 没安排 → 返回 `"你未被安排至xxx工作"`

#### 情况 B：未被抢（WorkArrangement 无记录）

→ 查 `StaffDispatch` 链，看该工作的执行人是否包含扫码员工：

  - **B1** — 安排了 → ✅ **返回该工作**
  - **B2** — 没安排 → 返回 `"你未被安排至xxx工作"`

## 总结

```
扫码 group_key
  │
  ├─ Step1: 周期匹配 → 找到当前时段的工作
  │
  ├─ Step2: 查 WorkArrangement（是否被抢）
  │
  ├─ 被抢? ──┬── 抢的人是我? ──┬── 是 → ✅ 返回工作
  │          │                │
  │          │                └── 否 → StaffDispatch 有我? ──┬── 是 → "该工作已被额外安排"
  │          │                                              │
  │          │                                              └── 否 → "你未被安排至xxx工作"
  │          │
  └─ 没抢? ──┼── StaffDispatch 有我? ──┬── 是 → ✅ 返回工作
             │                        │
             └── 否 → "你未被安排至xxx工作"
```
