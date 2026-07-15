import request from './request'

/** 免登 — 通过钉钉授权码获取用户信息 GET /publicMesg/getUserByCode/<code> */
export interface UserLoginResult {
  userid: string
  avatar: string
  token: string // JWT
  username: string
  position: string
  depart: string
  depid: string
  mobile?: string
}

export function getUserBycode(code: string) {
  return request.get<any, { code: number, result: UserLoginResult | null }>(
    `/api/publicMesg/getUserByCode/${code}`,
  )
}

/** 获取请求签名码 — GET /publicMesg/getRequestCode */
export function getRequestCode() {
  return request.get<any, string>('/api/publicMesg/getRequestCode')
}

/** 刷新员工列表 — GET /publicMesg/refreshEmpList */
export function refreshEmpList() {
  return request.get<any, { code: number, refresh: string }>(
    '/api/publicMesg/refreshEmpList',
  )
}

/** 刷新项目列表 — GET /publicMesg/refreshProjectList */
export function refreshProjectList() {
  return request.get<any, { code: number, refresh: string }>(
    '/api/publicMesg/refreshProjectList',
  )
}

/** 获取 COS 临时上传令牌 — GET /api/publicMesg/getCosTempToken */
export interface CosTempTokenResult {
  tmpSecretId: string
  tmpSecretKey: string
  sessionToken: string
  expiredTime: number
  startTime: number
  Bucket: string
  Region: string
}

export function getCosTempToken() {
  return request.get<any, { code: number, result: CosTempTokenResult }>(
    '/api/publicMesg/getCosTempToken',
  )
}
