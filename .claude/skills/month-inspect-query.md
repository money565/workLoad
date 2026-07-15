---
name: month-inspect-query
description: 如何查询检查是否覆盖了全部的工作 — 本月巡检后端查询逻辑
---

# 查询检查是否覆盖了全部的工作

## 输入

前端传入选中的月份（如 `2026-07`）。

## 查询步骤

### Step 1 — 获取本月已检查的工作（res1）

```python
from local_server.apps.workLoad.models import WorkExecution, WorkPlanWorks

# 筛选 check_time 不为空，且年份/月份匹配选中月份的执行记录
executions = WorkExecution.objects.filter(
    check_time__isnull=False,
    check_time__year=year,
    check_time__month=month,
)

# 通过 work_plan 外键拿 WorkPlanWorks 的 group_key
# group_key 相同的工作只保留一条（去重）
seen = set()
res1 = []  # [{ group_key, check_time }]
for e in executions:
    gk = e.work_plan.group_key
    if gk and gk not in seen:
        seen.add(gk)
        res1.append({'group_key': gk, 'check_time': e.check_time})
```

### Step 2 — 获取全部工作（res2）

```python
# 取出所有 WorkPlanWorks，按 group_key 去重（同组只取第一条）
all_works = WorkPlanWorks.objects.all().order_by('id')
seen = set()
res2 = []  # [{ group_key, work_name, work_cycle, exec_time, feq }]
group_counts = {}  # 统计每个 group_key 的工作数量

# 先统计频次
for w in all_works:
    if w.group_key:
        group_counts[w.group_key] = group_counts.get(w.group_key, 0) + 1

# 再去重取第一条
for w in all_works:
    gk = w.group_key
    if gk and gk not in seen:
        seen.add(gk)
        res2.append({
            'group_key': gk,
            'work_name': w.work_name,
            'work_cycle': w.work_cycle,
            'exec_time': w.exec_time,
            'feq': group_counts.get(gk, 1),
        })
```

### Step 3 — 合并结果

```python
# 构建 res1 索引：{ group_key: check_time }
checked_map = {item['group_key']: item['check_time'] for item in res1}

# 对 res2 中每条工作，查找是否在 res1 中
result = []
for item in res2:
    gk = item['group_key']
    if gk in checked_map:
        result.append({
            **item,
            'checked': True,
            'check_time': checked_map[gk].isoformat(),
        })
    else:
        result.append({
            **item,
            'checked': False,
            'check_time': None,
        })

return result
```

## 返回数据结构

```typescript
interface InspectResult {
  group_key: string
  work_name: string       // 工作名称
  work_cycle: number      // 0=每日 1=每周 2=每月
  exec_time: number       // 执行时间
  feq: number             // 同组工作个数（频次）
  checked: boolean        // 本月是否已检查
  check_time: string | null  // 检查时间
}
```

## 关键点

- **去重维度是 `group_key`**，不是 `work_id`。同 `group_key` 的工作视为同一组，只检查一次即可覆盖整组。
- **`feq`** 是同 `group_key` 工作的个数，用于前端显示该组包含几个时间槽。
- 只有 `check_time` 落在选中月份的 `WorkExecution` 才算"本月已检查"。
