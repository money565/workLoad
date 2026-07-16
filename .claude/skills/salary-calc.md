---
name: salary-calc
description: 计算员工当月薪资 — 从 WorkExecution 中按月份+员工筛选合格记录，汇总 WorkPlanWorks.price
---

# 员工薪资计算

## 输入

- `userid`: 员工钉钉 userid（或 `emp_id`）
- `year`: 年份
- `month`: 月份

## 逻辑

### Step 1：确定日期范围

```python
from datetime import date, timedelta

start = date(year, month, 1)
# 月末：下个月1号 - 1天
if month == 12:
    end = date(year + 1, 1, 1) - timedelta(days=1)
else:
    end = date(year, month + 1, 1) - timedelta(days=1)
```

### Step 2：查询合格执行记录

```python
from local_server.apps.workLoad.models import WorkExecution
from local_server.apps.publicMesg.models import PublicMesgEmpList

# 通过 userid 找到员工
emp = PublicMesgEmpList.objects.filter(userid=userid).first()

# 筛选：上传者(执行人)是该员工、检查结果为合格(1)、时间在当月范围内
executions = WorkExecution.objects.filter(
    uploader=emp,               # 执行人
    check_result=1,             # 合格
    upload_time__date__gte=start,
    upload_time__date__lte=end,
).select_related('work_plan')
```

### Step 3：汇总薪资

```python
total = 0
details = []
for e in executions:
    price = float(e.work_plan.price or 0)
    total += price
    details.append({
        'work_name': e.work_plan.work_name,
        'price': price,
        'unit': e.work_plan.unit,
        'number': e.work_plan.number,
        'upload_time': e.upload_time.isoformat(),
    })

print(f'{emp.name} {year}年{month}月薪资: {total}元')
```

## 完整示例

```python
def calc_salary(userid, year, month):
    from datetime import date, timedelta
    from local_server.apps.workLoad.models import WorkExecution
    from local_server.apps.publicMesg.models import PublicMesgEmpList

    emp = PublicMesgEmpList.objects.filter(userid=userid).first()
    if not emp:
        return {'error': '员工不存在'}

    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)

    executions = WorkExecution.objects.filter(
        uploader=emp,
        check_result=1,
        upload_time__date__gte=start,
        upload_time__date__lte=end,
    ).select_related('work_plan')

    total = 0
    items = []
    for e in executions:
        price = float(e.work_plan.price or 0)
        total += price
        items.append({
            'work_name': e.work_plan.work_name,
            'price': price,
            'unit': e.work_plan.unit,
            'count': e.work_plan.number,
            'amount': price * (e.work_plan.number or 1),
        })

    return {
        'name': emp.name,
        'month': f'{year}年{month}月',
        'total': round(total, 2),
        'items': items,
    }
```

## 关键点

| 条件 | 说明 |
|------|------|
| `uploader` | 执行人（上传工作照片的人），不是 `executor` |
| `check_result = 1` | 只统计检查合格的工作 |
| `upload_time__date__gte/lte` | 限定在当月日期范围内 |
| `select_related('work_plan')` | 预加载工作计划，避免 N+1 查询 |
