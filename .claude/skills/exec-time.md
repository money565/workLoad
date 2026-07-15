---
name: exec-time
description: exec_time 字段的含义与显示规则 — 根据 work_cycle 决定取值来源和展示格式
---

# exec_time 字段规则

`exec_time` 在前端有两种形态：**单值**（单个工作）和**数组**（同 group_key 分组后）。

## 取值来源

| work_cycle | 单条工作 | 分组（同 group_key） |
|------------|---------|---------------------|
| 0 每日 | `exec_time = -1`（兜底），实际执行时间是 `start_time` | 收集同组各工作的 `start_time`（HH:mm）作为数组 |
| 1 每周 | `exec_time = 1~7`（星期一~星期日） | 收集同组各工作的 `exec_time` 值 |
| 2 每月 | `exec_time = 1~31`（几号） | 收集同组各工作的 `exec_time` 值 |

## 显示格式

### 单条工作

| work_cycle | 条件 | 显示 |
|------------|------|------|
| 0 每日 | `exec_time === -1` | `每天` |
| 0 每日 | 其他值 | 原样显示 |
| 1 每周 | `1~7` | `周一` ~ `周日` |
| 2 每月 | `1~31` | `15日` |

### 分组工作（数组）

| work_cycle | 数组内容 | 显示示例 |
|------------|---------|---------|
| 0 每日 | `start_time` 字符串数组 | `07:00, 14:00, 18:00` |
| 1 每周 | 星期数字数组 | `周一, 周三, 周五` |
| 2 每月 | 日期数字数组 | `1日, 15日, 28日` |

## 代码实现位置

- **分组逻辑**: `WorkManage.vue` `fetchData()` — `items.map(i => i.start_time?.slice(0,5) || '—')`（每日）或 `items.map(i => i.exec_time)`（周/月）
- **单条显示**: `WorkManage.vue` / `TodayTask.vue` / `WeekPlan.vue` / `MonthPlan.vue` 的 `bodyCell` 模板中 `column.key === 'exec_time'` 部分
- **停用选择**: `WorkManage.vue` `execTimeLabel()` — 生成 Tab 和对话框选项的标签
