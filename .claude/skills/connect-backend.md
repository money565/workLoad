---
name: connect-backend
description: 通过 SSH 连接后端服务器，执行远程操作、查看日志、传输文件
---

# 连接后端服务器

通过 SSH 远程连接到工作负载项目的后端服务器。

## ⚠️ 修改权限

**仅允许修改** `apps/workLoad/` 目录下的文件。后端项目的其他所有目录和文件（包括 `apps/publicMesg/`、`utils/`、`settings.py`、`urls.py` 等）均**禁止修改**——只能读取作为参考。

| 目录/文件 | 权限 |
|-----------|------|
| `apps/workLoad/` | ✅ 可读可写 |
| 其他所有内容 | ❌ 只读，禁止修改 |

## 服务器信息

| 项目 | 值 |
|------|-----|
| 地址 | `tanghui.iego.vip` |
| 端口 | `46070` |
| 用户名 | `xcserver` |
| 系统 | Ubuntu 22.04 (Linux 6.8.0-124-generic, x86_64) |

## 后端技术栈

| 项目 | 值 |
|------|-----|
| 语言 | Python |
| 框架 | Django |
| App 名 | `local_server.apps.workLoad` |
| WSGI 服务器 | uWSGI |
| 异步任务 | Celery |
| 虚拟环境 | `/home/xcserver/venv` |

## 项目目录结构

```
/home/xcserver/local_server/local_server/
├── apps/
│   ├── chatBot/             # ❌ 只读
│   ├── jobAndEmps/          # ❌ 只读
│   ├── publicMesg/          # ❌ 只读（公共资源，仅供前端调用接口参考）
│   ├── workLoad/            # ✅ 可修改（本项目后端）
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── tests.py
│   │   └── views.py
│   └── xcwebsit/            # ❌ 只读
├── settings.py              # ❌ 只读
├── urls.py                  # ❌ 只读
├── wsgi.py                  # ❌ 只读
├── asgi.py                  # ❌ 只读
├── celery.py                # ❌ 只读
├── uwsgi.ini                # ❌ 只读
├── uwsgi.pid                # ❌ 只读
├── uwsgi.log                # ❌ 只读
└── utils/                   # ❌ 只读（auth.py, jwt_utils.py）
```

## 公共资源 App — `publicMesg`

路由前缀: `/publicMesg/` 和 `/api/publicMesg/`

该 App 提供钉钉集成、用户鉴权、员工/部门查询、云存储令牌等公共服务，前端通过它对接钉钉和组织架构数据。

### Models

| 模型 | 表名 | 说明 |
|------|------|------|
| `PublicMesgProjectList` | `PublicMesgProjectList` | 部门/项目树（MPTT），含名称、钉钉部门ID、经纬度、父节点 |
| `PublicMesgEmpList` | `PublicMesgEmpList` | 员工列表，含姓名、钉钉userid、部门、职位、手机号、unionid、头像、在职状态(0在职/1离职/3其他) |

### Views 及路由

| 路由 | View Class | 方法 | 作用 |
|------|------------|------|------|
| `ddverify` | `DingDVerify` | GET/POST | 钉钉事件回调。POST 解密钉钉推送的组织架构变更消息，自动同步人员信息 |
| `refreshEmpList` | `RefreshEmpList` | GET | 触发 Celery 异步任务，全量刷新员工列表 |
| `refreshProjectList` | `RefreshProjectList` | GET | 触发 Celery 异步任务，全量刷新项目/部门列表 |
| `authentication` | `Authentication` | POST | 钉钉 JSAPI 鉴权签名。接收 `{timestamp, url}`，返回 `{corpId, msg(签名), nonce_str}` |
| `getUserByCode/<code>` | `GetUserByCode` | GET | 免登：用钉钉授权码换取用户信息，更新头像/unionid，生成 JWT token 返回 |
| `getRequestCode` | `GetRequestCode` | GET | 用 Django signing + 时间戳生成加密签名，供后端接口防篡改校验 |
| `getCosTempToken` | `GetCosTempToken` | GET | 获取腾讯云 COS 临时上传凭证（Bucket + Region + 临时密钥） |
| `getObsTempToken` | `GetObsTempToken` | GET | 获取华为云 OBS 临时上传凭证 |
| `searchManager` | `SearchManager` | POST | 搜索人员。参数 `{k: 关键词, pid: 项目ID}`。pid=-1 全局搜索，pid=-2 返回全部 |
| `getEmpByProject/<pid>` | `GetEmpByProject` | GET | 按项目ID返回员工 name/id 列表 |
| `getDetailById/<mid>` | `GetDetailById` | GET | 按员工ID返回详情（部门、姓名、职位、手机号、钉钉ID） |
| `getProject` | `GetProject` | GET | 返回层级嵌套的部门/项目树（含 parent 关系，用于级联选择器） |
| `getEmpByDepartWithNode/<depid>/<page>/<perPage>/<state>` | `GetEmpByDepartWithNode` | GET | 按部门+所有子部门分页查询员工。state: 0在职/1离职/其他全部，支持分页 |

### 关键外部依赖

- **钉钉加解密**: `DingCallbackCrypto3` — 处理钉钉回调消息的加密/解密
- **JWT**: `JWTUtils.generate_secure_token` — token 生成工具，位于 `local_server.utils.jwt_utils`
- **数据库树**: `django-mptt` — `PublicMesgProjectList` 用 MPTT 实现树形部门结构
- **腾讯云 COS**: `getCosTempToken` — 获取 COS 临时 STS 凭证
- **华为云 OBS**: `getObsTempToken` — 获取 OBS 临时凭证

### 员工与项目的关系

员工通过**两条路径**关联部门，形成双链路设计：

| 路径 | 字段 | 说明 |
|------|------|------|
| 冗余字段 | `PublicMesgEmpList.depid` (CharField) | 直接从钉钉 API 拉取的原始部门 ID |
| 外键 | `PublicMesgEmpList.project` (FK → PublicMesgProjectList, null=True, `related_name='base_project'`) | 同步任务中用 `depid` 匹配 ProjectList 表后写入 |

**同步流程 `synchronization_emp_name_list`**：

```
1. MakeEmpList().getUserMessage()
   → 调钉钉 /v1.0/hrm/rosters/lists/query 分页拉全部在职员工
   → 返回每人的 userid, username, depName, depID, position, mobile

2. 构建 depid_id_dict = {ProjectList.depid: ProjectList.id}

3. 遍历每个员工:
   ├── 若 depID 在 dict 中 → project_id = dict[depID] (绑定到对应项目)
   └── 若不在           → project_id = None (该部门尚未同步到项目表)

4. 存在则 update，不存在则 create

5. 标记离职: 钉钉返回列表中不存在的员工 → state 改为 1
```

**同步流程 `synchronization_Project_list`**：

```
1. allDepart(token) 拉取全部钉钉部门
2. 遍历创建/更新 PublicMesgProjectList (name, depid)
3. 构建 MPTT 树: 根据钉钉的 parent_id 设置 parent FK
   → 根部门(parent_id=1)的 parent 为 null
```

**设计要点**：
- `depid` 冗余不是坏设计 — 保证项目表未同步时员工数据也不丢失（`project` 暂时为 null）
- MPTT 树使 `GetEmpByDepartWithNode` 可一次查询部门 + 所有子部门的员工（`node.get_descendants(include_self=True)`）
- `SearchManager` 中 `pid=-1` 时按 `depid` 搜（走冗余字段），有具体 `pid` 时走 ForeignKey 精确匹配

## 认证与工具模块 — `utils/`

路径: `/home/xcserver/local_server/local_server/utils/`

| 文件 | 职责 |
|------|------|
| `auth.py` | 后台管理 JWT 认证中间件 + 登录/验签视图 |
| `jwt_utils.py` | 通用 JWT 生成工具（钉钉用户 token） |
| `getCosTempToken.py` | 腾讯云 COS 临时 STS 凭证（Redis 缓存） |

### 两套 JWT 体系

项目存在**两套独立的 JWT**，用途不同：

| 对比维度 | Manager JWT | User JWT |
|----------|-------------|----------|
| 文件 | `utils/auth.py` | `utils/jwt_utils.py` |
| 用途 | 后台管理系统登录 | 钉钉免登后的用户身份凭证 |
| 签发入口 | `POST /api/xcwebsite/manager/login` | `GET /publicMesg/getUserByCode/<code>` |
| payload | `{user_id, username, exp, iat}` | 用户信息 dict 合并 `{exp, iat}` |
| 签发条件 | Django `authenticate()` + `is_staff=True` | 钉钉 code 换 userid 成功后 |
| 算法 | HS256 | HS256 |
| 有效期 | 24 小时 | 24 小时 |
| 密钥 | `settings.SECRET_KEY` | `settings.SECRET_KEY` |

### ManagerAuthMiddleware 认证流程

```
请求进入 → 路径包含 'manager' ?
  ├── 否 → 直接放行
  └── 是 → 是否为 manager/login 或 pic-code ?
        ├── 是 → 放行（白名单）
        └── 否 → 检查 Authorization: Bearer <token>
              ├── 无头 → 401 "请先登录"
              ├── token 过期 → 401 "登录已过期，请重新登录"
              ├── token 无效 → 401 "token无效"
              └── 有效 → request.jwt_payload = payload，放行
```

中间件配置在 `settings.py` 的 `MIDDLEWARE` 中：`local_server.utils.auth.ManagerAuthMiddleware`

### ManagerLogin 登录流程

```
POST /api/xcwebsite/manager/login
  Body: {"username": "...", "password": "..."}
  ↓
Django authenticate(username, password)
  ├── 失败 → 401 "用户名或密码错误"
  ├── 非 staff → 403 "无管理权限"
  └── 成功 → 签发 JWT → 返回 {code:200, data:{token, username}}
```

### ManagerCheckToken 验签

```
GET /api/xcwebsite/manager/check-token
  Header: Authorization: Bearer <token>
  ↓ (经过中间件解密)
  request.jwt_payload 存在 → 返回 {code:200, data:{username}}
  request.jwt_payload 不存在 → 401 "未登录"
```

### JWTUtils.generate_secure_token

```python
# 位于 utils/jwt_utils.py
JWTUtils.generate_secure_token({"userid": "xxx", "username": "张三", ...})
# → HS256 JWT，有效期 24h
# 在 GetUserByCode 视图中调用，将钉钉用户信息编码为 token 返回给前端
```

### COS 临时令牌

```python
# utils/getCosTempToken.py → getCosTempToken()
# 1. 先查 Redis (public 连接) 中缓存的 cosToken
# 2. 缓存有效则直接返回
# 3. 缓存失效则调腾讯云 STS 获取新凭证
# 4. 写入 Redis，过期时间 = token 剩余有效期
# 返回: {tmpSecretId, tmpSecretKey, sessionToken, expiredTime, bucket, region}
```

## 使用方法

### SSH 连接

```bash
ssh -p 46070 xcserver@tanghui.iego.vip
```

### Python 自动化连接

```python
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    hostname="tanghui.iego.vip",
    port=46070,
    username="xcserver",
    password="1",
    timeout=10,
    allow_agent=False,
    look_for_keys=False,
)
stdin, stdout, stderr = client.exec_command("ls /home/xcserver/local_server/local_server/apps/workLoad")
print(stdout.read().decode())
client.close()
```

### 操作 Django

在操作 Django 前需先激活虚拟环境：

```bash
ssh -p 46070 xcserver@tanghui.iego.vip \
  "cd /home/xcserver/local_server/local_server && source /home/xcserver/venv/bin/activate && python manage.py check"

# 执行数据库迁移
ssh -p 46070 xcserver@tanghui.iego.vip \
  "cd /home/xcserver/local_server/local_server && source /home/xcserver/venv/bin/activate && python manage.py migrate"

# 查看 Django shell
ssh -p 46070 xcserver@tanghui.iego.vip \
  "cd /home/xcserver/local_server/local_server && source /home/xcserver/venv/bin/activate && python manage.py shell"
```

### 管理 uWSGI

配置文件: `/home/xcserver/local_server/local_server/uwsgi.ini`

```ini
# 关键配置
chdir = /home/xcserver/local_server
home = /home/xcserver/venv
module = local_server.wsgi:application
socket = 127.0.0.1:8080           # Nginx 反向代理到此端口
master = true
processes = 4                      # 4 进程
threads = 2                        # 每进程 2 线程
harakiri = 60                      # 请求超时 60s
max-requests = 5000                # 每进程处理 5000 请求后自动重启
pidfile = .../uwsgi.pid
daemonize = .../uwsgi.log          # 后台运行，日志输出到文件
buffer-size = 32768
```

```bash
# 启动 uWSGI（如果未运行）
ssh -p 46070 xcserver@tanghui.iego.vip \
  "cd /home/xcserver/local_server/local_server && source /home/xcserver/venv/bin/activate && uwsgi --ini uwsgi.ini"

# 重启 uWSGI（平滑重载，推荐）
ssh -p 46070 xcserver@tanghui.iego.vip \
  "cd /home/xcserver/local_server/local_server && source /home/xcserver/venv/bin/activate && uwsgi --reload uwsgi.pid"

# 停止 uWSGI
ssh -p 46070 xcserver@tanghui.iego.vip \
  "cd /home/xcserver/local_server/local_server && source /home/xcserver/venv/bin/activate && uwsgi --stop uwsgi.pid"

# 查看 uWSGI 日志
ssh -p 46070 xcserver@tanghui.iego.vip \
  "tail -f /home/xcserver/local_server/local_server/uwsgi.log"

# 查看 uWSGI 进程是否存活
ssh -p 46070 xcserver@tanghui.iego.vip \
  "ps aux | grep uwsgi | grep -v grep"
```

### 远程部署到 workLoad

```bash
# 上传文件到 workLoad 目录
scp -P 46070 local-file.py xcserver@tanghui.iego.vip:/home/xcserver/local_server/local_server/apps/workLoad/

# 上传后重启 uWSGI 使修改生效
ssh -p 46070 xcserver@tanghui.iego.vip \
  "cd /home/xcserver/local_server/local_server && source /home/xcserver/venv/bin/activate && uwsgi --reload uwsgi.pid"
```

---

## WorkPlanWorks 模型与 API

### 数据模型 (`apps/workLoad/models.py`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BigAutoField | 主键 |
| `project` | FK → PublicMesgProjectList | 关联项目/部门 |
| `work_name` | CharField(100) | 工作名称 |
| `salary` | DecimalField(10,2) | 工资 |
| `price` | DecimalField(10,2) | 单价（自动计算：salary/number/feq，保留4位小数） |
| `feq` | CharField(50) | 频次 |
| `unit` | CharField(20) | 单位 |
| `number` | IntegerField | 数量 |
| `start_time` | TimeField | 开始时间（默认 07:00） |
| `end_time` | TimeField | 结束时间（默认 18:00） |
| `work_type` | SmallIntegerField | 0日常/1计划/2临时/3其他（默认0） |
| `work_cycle` | SmallIntegerField | 0每日/1每周/2每月（默认0） |
| `exec_time` | IntegerField | -1每天/1-7星期/1-31日期（默认-1） |
| `status` | SmallIntegerField | 0正常/1停用（默认0） |
| `record_time` | TextField | 时间记录 JSON 数组（频次>1时记录具体时间，json.dumps/loads 转换） |

- 表名：`work_plan_works`
- 排序：按 `work_type` 升序
- 列表显示：名称、工资、单价、频次、单位、数量、开始/结束时间、类型、周期、状态

### API 端点 (`apps/workLoad/views.py`)

路由前缀：`/api/workLoad/`（在 `urls.py` 中注册）

| 方法 | 路径 | View | 功能 |
|------|------|------|------|
| GET | `empListByProject/<pid>` | EmpListByProject | 按项目查员工（完整信息） |
| GET | `workPlans/<pid>` | WorkPlanList.GET | 按项目查工作计划列表 |
| POST | `workPlans/<pid>` | WorkPlanList.POST | 创建工作计划（project_id=pid，record_time 自动 json.dumps） |
| PUT | `workPlan/<pk>` | WorkPlanDetail.PUT | 编辑工作计划（仅更新传入字段） |
| DELETE | `workPlan/<pk>` | WorkPlanDetail.DELETE | 删除工作计划 |

### 关键业务逻辑

**单价自动计算**：`price = salary / number / feq`，保留4位小数。工资/数量/频次任一变更触发重算，缺一时单价为0。

**执行时间联动**（前端 WorkManage.vue）：
- 工作周期=每日 → 只读显示"每天"，值=-1
- 工作周期=每周 → 下拉星期一~星期日，值1-7
- 工作周期=每月 → 下拉1日~31日，值1-31
- 切换周期自动重置默认值（每日→-1，其他→1）

**时间记录**（前端 WorkManage.vue）：
- 频次>1时显示"配置时间"按钮
- 弹窗自动生成等于频次数量的时间选择器（不可增减）
- 默认 07:00-18:00
- 提交时转 HH:mm 字符串数组，后端 json.dumps 存储，GET 时 json.loads 还原
- 列表中 hover 频次列显示具体时间 Tooltip

**项目切换**：创建/编辑对话框支持树形选择项目（默认当前项目），PUT 接口支持 `project_id` 更新关联。

**停用/启用**：行内按钮切换 status 0↔1，仅更新该字段。

**时间验证**：开始/结束时间变更时即时校验，结束<开始时标红提示并阻止提交。

**uWSGI 管理**：
```bash
# 重启（修改 views.py 或 models.py 后必须执行）
ssh -p 46070 xcserver@tanghui.iego.vip \
  "cd /home/xcserver/local_server/local_server && source /home/xcserver/venv/bin/activate && uwsgi --reload uwsgi.pid"

# 硬重启（reload 失败时）
ssh -p 46070 xcserver@tanghui.iego.vip \
  "pkill -9 -f uwsgi && cd /home/xcserver/local_server && source /home/xcserver/venv/bin/activate && uwsgi --ini local_server/uwsgi.ini"
```

### 钉钉免登流程（前端 stores/counter.ts）

```
App 启动 → login()
  → 检测钉钉环境 (navigator.userAgent 含 "DingTalk")
  ├── 非钉钉（浏览器）→ 恢复 localStorage 缓存
  └── 钉钉 webview
      → authentication() 获取鉴权签名
      → dd.error 注册（先于 dd.config）
      → dd.config() 尝试鉴权（失败静默）
      → dd.ready → 查 domainStorage 缓存
        ├── 有缓存 → 恢复
        └── 无缓存 → requestAuthCode（无需 dd.config）
            → getUserBycode → 获取用户信息 + JWT
            → 存 domainStorage + localStorage
      → 3秒超时兜底：dd.ready 不触发时直接免登
```

### Vue 项目核心配置

- **UI**: Ant Design Vue 4（自动按需导入）+ UnoCSS（原子CSS + 暗色模式）
- **状态**: Pinia setup stores（userStore, appCacheStore）
- **HTTP**: Axios 拦截器（自动附加 JWT token，统一错误处理）
- **代理**: Vite dev proxy 转发 `/api` 和 `/publicMesg` 到 `https://www.cdxcwy.cn`
- **调试**: vConsole（仅开发环境，钉钉内置浏览器无法看 console）
- **主题**: 明暗切换（a-config-provider + html.dark class + localStorage 持久化）
- **布局**: PC端 fixed inset-0 自适应屏幕（无浏览器滚动条）

### Ant Design Vue 中文配置

**关键**：语言包导入路径必须是 `ant-design-vue/es/locale/zh_CN`（带 `/es/`），否则日期组件、分页等不显示中文。

```typescript
// main.ts — 全局 dayjs 中文
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
dayjs.locale('zh-cn')

// App.vue / PcLayout.vue — ConfigProvider 包裹
import zhCN from 'ant-design-vue/es/locale/zh_CN'
// <a-config-provider :locale="zhCN">
```

**注意事项**：
- ConfigProvider 嵌套时会合并 locale，子组件可单独覆盖
- dayjs 和 Ant Design 的 locale 必须同时设置，缺一不可
- 日期组件用 `picker="month"` 时添加 `format="YYYY年M月"` 确保显示中文格式
- HTML 根元素 `lang="zh-CN"` 辅助浏览器识别

---

### WorkArrangement 工作市场/指派逻辑

**模型**: `WorkArrangement`（表 `work_arrangement`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `work` | FK → WorkPlanWorks | 关联工作 |
| `work_day` | IntegerField | 工作日（当月几号） |
| `work_month` | IntegerField | 工作月 |
| `work_week` | IntegerField | 工作周（本年第一个星期一=1） |
| `release_time` | DateTimeField | 放出时间(自动) |
| `ordertaker` | FK → PublicMesgEmpList | 接单人(可空) |
| `order_time` | DateTimeField | 接单时间(可空) |
| `status` | SmallIntegerField | 0待接单/1已接单/2已完成 |

**优先级**: WorkArrangement 优先级最高。当工作被放入市场后，该工作从今日任务/本周计划/本月计划列表中隐藏。

**流程**:
1. 在今日任务/本周计划/本月计划中，未执行的工作行显示"放入市场"按钮
2. 点击 → `POST /api/workLoad/arrangements/<pid>` → 创建 WorkArrangement（work_id, work_day, work_month, work_week 根据当前时间自动填充，ordertaker 为空）
3. 页面自动刷新，该工作从任务列表消失，出现在工作市场页面
4. "指派"按钮 → 弹窗选择项目内人员 → 点击确认 → 更新 ordertaker，状态变为"已接单"

**周计算**:
- 本年第一个星期一为第1周
- `calcWorkWeek(dayjs)` 函数前端计算

## 工作周期（本周期）定义

WorkPlanWorks 的 `work_cycle` 决定了"本周期"的计算方式：

| work_cycle | 名称 | 本周期范围 |
|------------|------|-----------|
| 0 | 每日 | 当天（00:00 ~ 23:59） |
| 1 | 每周 | 本周一 ~ 本周日（周一为起始，周日为结束） |
| 2 | 每月 | 本月1日 ~ 本月最后一日（28/29/30/31，按实际月份天数） |

**WorkArrangement 周期过滤规则**：
- 今日任务页面：仅排除 `work_day` 等于今天日期的工作市场记录
- 本周计划页面：仅排除 `work_week` 等于当前周数（本年第一个星期一=第1周）的记录
- 本月计划页面：仅排除 `work_month` 等于当前月份(1-12)的记录

**周数计算**（前端 `calcWorkWeek`）：
```typescript
function calcWorkWeek(d: dayjs.Dayjs): number {
  const start = dayjs(`${d.year()}-01-01`)
  let firstMon = start.day() === 1 ? start : start.add(8 - start.day(), 'day')
  if (d.isBefore(firstMon)) {
    const prevStart = dayjs(`${d.year()-1}-01-01`)
    firstMon = prevStart.day() === 1 ? prevStart : prevStart.add(8 - prevStart.day(), 'day')
  }
  return Math.max(1, Math.ceil(d.diff(firstMon, 'day') / 7) + 1)
}
```

## 工作执行状态检查逻辑

移动端扫码进入工作页面时，`MobileScanView` API 会自动判断该项工作是否已执行。

### 判断规则

| 工作周期 | work_cycle | 判断逻辑 |
|----------|-----------|----------|
| 每日 | 0 | 查询 `WorkExecution` 表中当天（`upload_time__date=today`）是否有记录 |
| 每周 | 1 | 获取当前日期，计算本周一和本周日的日期，查询该范围内是否有记录 |
| 每月 | 2 | 1. 当天日期 < `exec_time`（执行日）→ 返回 `false`，提示"还没到检查时间（每月X日）"<br>2. 当天日期 >= `exec_time` → 查询从 `exec_time` 日到当天是否有记录 |

### 返回逻辑

- **无记录**：`executed: false` → 前端显示拍照界面
- **有记录**：`executed: true`，`msg: "该工作已经于 YYYY-MM-DD HH:MM 被XXX执行"`
  - 前端显示警告卡片，禁止再次提交
  - `XXX` 为 `WorkExecution.uploader.name`（上传人姓名）

### 后端实现位置

`apps/workLoad/views.py` → `MobileScanView.get()`
