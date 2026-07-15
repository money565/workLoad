import request from './request'

/** 钉钉 JSAPI 鉴权签名 — POST /publicMesg/authentication */
export interface AuthParams {
  timestamp: number
  url: string
}

export interface AuthResult {
  code: number
  msg: string // 签名
  timestamp: number
  nonce_str: string
  ClientID: string
  corpId: string
}

export function authentication(params: AuthParams) {
  return request.post<any, AuthResult>('/api/publicMesg/authentication', params)
}

/** 按关键词搜索员工 — POST /publicMesg/searchManager */
export interface SearchManagerParams {
  k: string
  pid: number // 项目ID，-1 全局搜索，-2 返回全部
}

export interface EmployeeItem {
  id: number
  title: string
  name: string
  depName: string
  posit: string
  mobile: string
}

export function searchManager(params: SearchManagerParams) {
  return request.post<any, { code: number, result: EmployeeItem[] }>(
    '/api/publicMesg/searchManager',
    params,
  )
}

/** 获取部门/项目树 — GET /publicMesg/getProject */
export interface ProjectNode {
  id: number
  label: string
  value: string
  parent: number | null
}

export function getProject() {
  return request.get<any, ProjectNode[]>('/api/publicMesg/getProject')
}

/** 获取部门（扁平列表） — GET /publicMesg/getChildrenProjectList */
export interface ProjectFlatItem {
  label: string
  key: number
}

export function getChildrenProjectList() {
  return request.get<any, { code: number, result: ProjectFlatItem[] }>(
    '/api/publicMesg/getChildrenProjectList',
  )
}

/** 按项目ID查员工 — GET /publicMesg/getEmpByProject/<pid> */
export interface EmpBrief {
  name: string
  id: number
}

export function getEmpByProject(pid: number) {
  return request.get<any, { code: number, result: EmpBrief[] }>(
    `/api/publicMesg/getEmpByProject/${pid}`,
  )
}

/** 按部门+分页查员工 — GET /publicMesg/getEmpByDepartWithNode/<depid>/<page>/<perPage>/<state> */
export interface EmpWithState extends EmpBrief {
  depName: string
  posit: string
  state: number
  userid: string
}

export function getEmpByDepartWithNode(
  depid: string,
  page: number = 1,
  perPage: number = 20,
  state: number = 0,
) {
  return request.get<any, { total: number, result: EmpWithState[] }>(
    `/api/publicMesg/getEmpByDepartWithNode/${depid}/${page}/${perPage}/${state}`,
  )
}

/** 获取 COS 临时上传令牌 — GET /publicMesg/getCosTempToken */
export interface CosTempToken {
  tmpSecretId: string
  tmpSecretKey: string
  sessionToken: string
  expiredTime: number
  startTime: number
  Bucket: string
  Region: string
}

export function getCosTempToken() {
  return request.get<any, { code: number, result: CosTempToken }>(
    '/api/publicMesg/getCosTempToken',
  )
}

/** 按项目ID查员工（完整信息）— GET /api/workLoad/empListByProject/<pid> */
export interface EmpFullInfo {
  id: number
  name: string
  depName: string
  posit: string
  mobile: string
  userid: string
  avatar: string
  state: number
}

export function getEmpListByProject(pid: number) {
  return request.get<any, { code: number, result: EmpFullInfo[] }>(
    `/api/workLoad/empListByProject/${pid}`,
  )
}

// ========== 工作计划 ==========

export interface WorkPlanItem {
  id: number
  work_name: string
  price: number
  salary: number
  unit: string
  number: number
  start_time: string | null
  end_time: string | null
  work_cycle: number
  exec_time: number
  status: number
  group_key: string
}

export interface WorkPlanCreateParams {
  work_name: string
  price?: number
  salary?: number
  unit?: string
  number?: number
  start_time?: string
  end_time?: string
  work_cycle?: number
  exec_time?: number
  status?: number
  group_key?: string
}

export function getWorkPlans(pid: number) {
  return request.get<any, { code: number, result: WorkPlanItem[] }>(
    `/api/workLoad/workPlans/${pid}`,
  )
}

export function createWorkPlan(pid: number, params: WorkPlanCreateParams) {
  return request.post<any, { code: number, msg: string, id: number }>(
    `/api/workLoad/workPlans/${pid}`,
    params,
  )
}

export function updateWorkPlan(pk: number, params: WorkPlanCreateParams) {
  return request.put<any, { code: number, msg: string }>(
    `/api/workLoad/workPlan/${pk}`,
    params,
  )
}

export function deleteWorkPlan(pk: number) {
  return request.delete<any, { code: number, msg: string }>(
    `/api/workLoad/workPlan/${pk}`,
  )
}

// ========== 岗位管理 ==========

export interface PositionItem {
  id: number
  name: string
  project_id: number
  works: number[]
  work_names: string[]
  status: number
  created_at: string
}

export interface PositionCreateParams {
  name: string
  status?: number
  work_ids?: number[]
}

export function getPositions(pid: number) {
  return request.get<any, { code: number, result: PositionItem[] }>(
    `/api/workLoad/positions/${pid}`,
  )
}

export function createPosition(pid: number, params: PositionCreateParams) {
  return request.post<any, { code: number, msg: string, id: number }>(
    `/api/workLoad/positions/${pid}`,
    params,
  )
}

export function updatePosition(pk: number, params: { name?: string; status?: number; work_ids?: number[]; project_id?: number }) {
  return request.put<any, { code: number, msg: string }>(
    `/api/workLoad/position/${pk}`,
    params,
  )
}

export function deletePosition(pk: number) {
  return request.delete<any, { code: number, msg: string }>(
    `/api/workLoad/position/${pk}`,
  )
}

// ========== 人员调配 ==========

export interface StaffDispatchItem {
  id: number
  project_id: number
  emp_ids: number[]
  emp_names: string[]
  position_ids: number[]
  position_names: string[]
  status: number
  created_at: string
}

export function getStaffDispatches(pid: number) {
  return request.get<any, { code: number, result: StaffDispatchItem[] }>(
    `/api/workLoad/staffDispatch/${pid}`,
  )
}

export function createStaffDispatch(pid: number, params: { status?: number; emp_ids?: number[]; position_ids?: number[] }) {
  return request.post<any, { code: number, msg: string, id: number }>(
    `/api/workLoad/staffDispatch/${pid}`,
    params,
  )
}

export function updateStaffDispatch(pk: number, params: { status?: number; project_id?: number; emp_ids?: number[]; position_ids?: number[] }) {
  return request.put<any, { code: number, msg: string }>(
    `/api/workLoad/staffDispatchDetail/${pk}`,
    params,
  )
}

export function deleteStaffDispatch(pk: number) {
  return request.delete<any, { code: number, msg: string }>(
    `/api/workLoad/staffDispatchDetail/${pk}`,
  )
}

// ========== 工作标准 ==========

export interface WorkStandardItem {
  id: number; name: string; content: string; status: number; created_at: string
  work_ids: number[]; work_names: string[]
}

export function getStandards(pid: number) {
  return request.get<any, { code: number; result: WorkStandardItem[] }>(`/api/workLoad/standards/${pid}`)
}
export function createStandard(pid: number, params: { name: string; content?: string[]; work_ids?: number[]; group_keys?: string[]; project_id?: number }) {
  return request.post<any, { code: number; msg: string; id: number }>(`/api/workLoad/standards/${pid}`, params)
}
export function updateStandard(pk: number, params: { name?: string; content?: string[]; status?: number; work_ids?: number[]; group_keys?: string[]; project_id?: number }) {
  return request.put<any, { code: number; msg: string }>(`/api/workLoad/standard/${pk}`, params)
}
export function deleteStandard(pk: number) {
  return request.delete<any, { code: number; msg: string }>(`/api/workLoad/standard/${pk}`)
}
