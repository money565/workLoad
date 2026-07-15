---
name: work-ownership
description: 判断工作是否属于用户的查询逻辑 — 员工→调配→岗位→工作的正向/反向链路
---

# 工作归属判断

判断"某个工作是否属于某个用户"涉及 Django ORM 中四张表的关联查询：

## 涉及模型

```
PublicMesgEmpList          StaffDispatch              Position                WorkPlanWorks
┌──────────────────┐      ┌──────────────────┐      ┌──────────────┐      ┌──────────────┐
│ id (PK)          │◄──┐  │ id (PK)          │      │ id (PK)      │      │ id (PK)      │
│ userid (钉钉ID)   │   │  │ project (FK)     │      │ project (FK) │      │ work_name    │
│ name             │   ├──│ emps (M2M) ◄──────┤  ┌───│ works (M2M)  │◄─────│ price        │
│ depName          │   │  │ positions (M2M) ──┤──┘   │ name         │      │ unit         │
│ posit            │   │  │ status           │      │ status       │      │ work_cycle   │
│ mobile           │   │  │ created_at       │      │ created_at   │      │ exec_time    │
│ avatar           │   │  └──────────────────┘      └──────────────┘      │ status       │
│ state (在职状态)  │   │                                                  └──────────────┘
└──────────────────┘   │
       employees (多个)  │
       ──────────────────┘
```

**关系链**: `PublicMesgEmpList` ←(M2M)→ `StaffDispatch` ←(M2M)→ `Position` ←(M2M)→ `WorkPlanWorks`

## 正向查询：用户 → 工作

> 前端传 `userid`，判断用户是否拥有某个 `work_id`

**后端实现参考**: `views.py` → `MobileScanView.get`（第 213-270 行）

```python
from local_server.apps.publicMesg.models import PublicMesgEmpList
from local_server.apps.workLoad.models import StaffDispatch

def get_user_works(userid: str, work_id: int | None = None) -> bool:
    """
    正向查询: userid → 员工 → 调配 → 岗位 → 工作
    返回: 该工作是否属于该用户
    """
    # Step 1: userid → 员工记录
    emp = PublicMesgEmpList.objects.filter(userid=userid).first()
    if not emp:
        return False  # 用户不存在

    # Step 2: 员工 → 调配（只查生效中的调配）
    dispatches = StaffDispatch.objects.filter(emps=emp, status=0)
    if not dispatches.exists():
        return False  # 用户未被调配到任何岗位

    # Step 3: 调配 → 岗位 → 工作
    for d in dispatches:
        for pos in d.positions.filter(status=0):   # 只查生效中的岗位
            # Step 4: 岗位.works 是否包含目标 work_id
            if work_id:
                if pos.works.filter(id=work_id).exists():
                    return True
            else:
                # 不传 work_id 则返回该用户的所有工作
                works = pos.works.all()
                ...
    return False
```

**关键 Django ORM 查询**:

| 步骤 | ORM | 说明 |
|------|-----|------|
| userid → emp | `PublicMesgEmpList.objects.filter(userid=uid).first()` | `userid` 是钉钉用户 ID（字符串） |
| emp → dispatches | `StaffDispatch.objects.filter(emps=emp, status=0)` | M2M 反向查询，`status=0` 只查生效调配 |
| dispatch → positions | `d.positions.filter(status=0)` | M2M 反向查询，`status=0` 只查生效岗位 |
| position → works | `pos.works.filter(id=wid)` 或 `pos.works.all()` | M2M 反向查询 |

## 反向查询：工作 → 用户

> 已知 `work_id`，查询哪些用户拥有该工作，判断是否包含某个 `userid`

```python
from local_server.apps.workLoad.models import WorkPlanWorks, Position, StaffDispatch
from local_server.apps.publicMesg.models import PublicMesgEmpList

def work_belongs_to_user(work_id: int, userid: str) -> bool:
    """
    反向查询: 工作 → 岗位 → 调配 → 员工 → userid
    返回: 该工作是否属于该用户
    """
    # Step 1: work_id → 工作对象
    work = WorkPlanWorks.objects.filter(id=work_id).first()
    if not work:
        return False

    # Step 2: 工作 → 所属岗位（通过 related_name='positions'）
    #         WorkPlanWorks.positions 是 M2M 反向引用
    positions = work.positions.filter(status=0)
    if not positions.exists():
        return False  # 该工作未被分配到任何生效岗位

    # Step 3: 岗位 → 调配
    for pos in positions:
        # Position.staff_dispatches 是 M2M 反向引用 (related_name='staff_dispatches')
        dispatches = pos.staff_dispatches.filter(status=0)
        for d in dispatches:
            # Step 4: 调配 → 员工 → userid
            for emp in d.emps.all():
                if emp.userid == userid:
                    return True

    return False
```

**Django ORM 一步到位的写法**:

```python
# 反向查询: 一条语句判断 work_id 是否属于 userid
WorkPlanWorks.objects.filter(
    id=work_id,
    positions__status=0,                    # work → positions (M2M 反向)
    positions__staff_dispatches__status=0,   # position → dispatches (M2M 反向)
    positions__staff_dispatches__emps__userid=userid,  # dispatch → emps → userid
).exists()
```

**查询链路拆解**:

```
WorkPlanWorks.id = work_id
  └─ positions (M2M 反向, related_name='positions')
       └─ Position.status = 0
            └─ staff_dispatches (M2M 反向, related_name='staff_dispatches')
                 └─ StaffDispatch.status = 0
                      └─ emps (M2M, related_name='staff_dispatches')
                           └─ PublicMesgEmpList.userid = userid
```

## 正向 vs 反向对比

| 维度 | 正向（userid → works） | 反向（work → userid） |
|------|----------------------|---------------------|
| 入口 | `userid` | `work_id` |
| 适用场景 | 获取用户的所有工作列表 | 判断某个工作属于谁 |
| 后端 API | `GET /api/workLoad/mobileScan/<userid>` | 无现成 API，需组合查询 |
| 查询复杂度 | 3 次 M2M 穿透 | 3 次 M2M 穿透（方向相反） |
| 性能 | 适合列表展示 | 适合单条鉴权 |

## 在前端判断的局限性

前端无法直接执行这些查询。替代方案：

1. **调用 `mobileScan?wid=<work_id>`**: 后端执行正向查询，返回结果为空表示不属于用户
2. **调用 `mobileScan` 获取全部工作列表**: 前端缓存后在本地判断 `work_id` 是否存在
3. **名称匹配（不可靠）**: 通过 `ordertaker_name === username` 判断工作市场接单人 — **仅适用于 WorkArrangement，不适用于 StaffDispatch 分配的工作**
