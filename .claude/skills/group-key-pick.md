---
name: group-key-pick
description: 通过 group_key 和当前时间确定返回同组中的哪一个工作
---

# 通过 group_key 和时间确定当前工作

## 输入

- `group_key`: 工作组标识
- `userid`: 当前用户

## 流程

### Step 1：查同组所有工作

```python
works = WorkPlanWorks.objects.filter(group_key=group_key).order_by('id')
if works.count() == 1:
    return works[0].id  # 只有一条，直接返回
```

### Step 2：多条时按 work_cycle 和时间选择

---

## work_cycle = 0（每日）

按 `start_time` 排序，根据**当前时间**落在哪个区间来选择：

```
start_time:  12:00    15:00    19:00
               |--------|--------|
当前时间:  11:00    13:00    20:00
           ↓        ↓        ↓
         不返回    选12:00   选18:00
```

**规则**：
1. 将同组工作按 `start_time` 升序排列
2. 若当前时间 < 最早的 start_time → **不返回**（还没到第一个时段）
3. 若当前时间 >= 最晚的 start_time → **返回最后一个工作**
4. 否则找到当前时间所在的区间 `[start[i], start[i+1])`，**返回 start[i] 对应的工作 id**

```python
from datetime import datetime

works = list(works)  # 同组工作
now = datetime.now().time()

# 按 start_time 排序
sorted_works = sorted([w for w in works if w.start_time], key=lambda w: w.start_time)

if not sorted_works:
    return None  # 无 start_time，无法判断

first = sorted_works[0].start_time
last = sorted_works[-1].start_time

if now < first:
    return None  # 还没到第一个时段

if now >= last:
    return sorted_works[-1].id  # 已过最后一个时段，返回最后一个工作

for i in range(len(sorted_works) - 1):
    if sorted_works[i].start_time <= now < sorted_works[i+1].start_time:
        return sorted_works[i].id

return None
```

## work_cycle = 1（每周）

按 `exec_time`（1=周一~7=周日）排序，根据**当前星期几**选择：

```
exec_time:  1(周一)    3(周三)    5(周五)
               |----------|----------|
当前星期:  2(周二)  4(周四)   6(周六)
           ↓        ↓        ↓
          选1(周一) 选3(周三) 选5(周五)
```

**规则**：
1. 将同组工作按 `exec_time` 升序排列
2. 找到 **<= 当前星期几** 的最大 `exec_time` 对应的工作
3. 如果当前星期几 < 所有 exec_time → 不返回

```python
from datetime import datetime

today_weekday = datetime.now().isoweekday()  # 1=周一, 7=周日

sorted_works = sorted(works, key=lambda w: w.exec_time)

selected = None
for w in sorted_works:
    if w.exec_time <= today_weekday:
        selected = w
    else:
        break

return selected.id if selected else None
```

## work_cycle = 2（每月）

按 `exec_time`（1~31）排序，根据**当前日期**选择：

```
exec_time:  1日    15日    28日
               |-------|-------|
当前日期:  5日    20日    31日
           ↓      ↓       ↓
          选1日   选15日   选28日
```

**规则**：
1. 将同组工作按 `exec_time` 升序排列
2. 找到 **<= 当前日期** 的最大 `exec_time` 对应的工作
3. 如果当前日期 < 所有 exec_time → 不返回

```python
from datetime import datetime

today_day = datetime.now().day

sorted_works = sorted(works, key=lambda w: w.exec_time)

selected = None
for w in sorted_works:
    if w.exec_time <= today_day:
        selected = w
    else:
        break

return selected.id if selected else None
```

## 总结

| work_cycle | 排序字段 | 比较值 | 逻辑 |
|------------|---------|--------|------|
| 0 每日 | `start_time` | 当前时间 | 找当前时间所在区间取左边界；超出最晚时间取最后一个 |
| 1 每周 | `exec_time` | 当前星期几 | 取 <= 当前星期几的最大值 |
| 2 每月 | `exec_time` | 当前日期 | 取 <= 当前日期的最大值 |
