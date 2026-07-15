import { authentication } from '@/axios/interface'
import { getUserBycode } from '@/axios/interfaceLogin'
import dd from 'dingtalk-jsapi'
import { defineStore } from 'pinia'

interface userInfoOPT {
  depart: string
  depid: string
  position: string
  userid: string
  username: string
  rank: number | string
  token: string | null
  avatar: string
  mobile: string
}
export const useUserStore = defineStore('user', () => {
  const token = ref('')
  const mesg = ref('')
  const mqttReady = ref(false)
  const loginReady = ref(false)
  const userInfo = ref<userInfoOPT>({
    depart: '',
    depid: '',
    position: '',
    userid: '',
    username: '',
    rank: 0,
    avatar: '',
    token: null,
    mobile: '',
  })
  const permission_list = ref<number[]>([])
  const permissions = ref<number>(0)
  const userRank = ref(0)

  async function fetchUserRank() {
    if (!userInfo.value.userid) return
    try {
      const res = await fetch(`/api/workLoad/permission/${userInfo.value.userid}`).then(r => r.json())
      if (res.code === 200) userRank.value = res.rank || 0
    } catch { userRank.value = 0 }
  }
  // 检测是否在钉钉 webview 内
  const isDingTalk = /DingTalk/i.test(navigator.userAgent)

  async function login() {
    console.log('🔐 开始登录... 钉钉环境:', isDingTalk)

    // 非钉钉环境：必须有 token 才能进入
    if (!isDingTalk) {
      const cached = localStorage.getItem('workLoad_user')
      const token = localStorage.getItem('workLoad_token')
      if (cached && token) {
        userInfo.value = JSON.parse(cached)
        loginReady.value = true
        console.log('✅ 非钉钉环境（恢复缓存）:', userInfo.value)
        await fetchUserRank()
        return { result: true, mesg: '恢复缓存' }
      }
      loginReady.value = false
      console.warn('⛔ 无 JWT 登录信息，拒绝访问')
      return { result: false, mesg: '未登录' }
    }

    // ====== 钉钉免登流程 ======
    const authData = {
      timestamp: Math.trunc(new Date().getTime() / 1000),
      url: window.location.href,
    }

    const res = await authentication(authData)
    console.log('🔑 鉴权签名获取成功:', { corpId: res.corpId })

    // 核心登录函数：拿 code → 换用户信息
    async function doDingLogin() {
      console.log('📡 请求免登...')
      const authCode = await dd.runtime.permission.requestAuthCode({
        corpId: 'ding740dacb926a2a89635c2f4657eb6378f',
      })
      const userRes = await getUserBycode(authCode.code)
      if (!userRes.result) {
        throw new Error('获取用户信息失败')
      }

      // 存 domainStorage
      try {
        await dd.util.domainStorage.setItem({
          name: 'workLoad',
          value: JSON.stringify(userRes.result),
        })
      } catch { /* 非钉钉环境可能失败 */ }

      if (userRes.result.token) {
        localStorage.setItem('workLoad_token', userRes.result.token)
      }
      localStorage.setItem('workLoad_user', JSON.stringify(userRes.result))

      userInfo.value = { ...userRes.result, rank: 0 }
      loginReady.value = true
      fetchUserRank()
      return userRes.result
    }

    return new Promise((resolve, reject) => {
      let settled = false

      // 先检查本地缓存
      dd.ready(async () => {
        if (settled) return
        try {
          const info = await dd.util.domainStorage.getItem({ name: 'workLoad' })
          if (info.value) {
            settled = true
            const cached = JSON.parse(info.value)
            if (cached.token) localStorage.setItem('workLoad_token', cached.token)
            localStorage.setItem('workLoad_user', info.value)
            userInfo.value = cached
            loginReady.value = true
            fetchUserRank()
            console.log('✅ 钉钉免登（缓存）:', userInfo.value)
            return resolve({ result: true, mesg: '来自本地缓存' })
          }
        } catch { /* domainStorage 不可用 */ }

        // 无缓存 → 直接免登（requestAuthCode 不需要 dd.config）
        try {
          const result = await doDingLogin()
          settled = true
          console.log('✅ 钉钉免登成功:', result)
          resolve({ result: true, mesg: '来自服务器' })
        } catch (err) {
          settled = true
          console.error('❌ 免登失败:', err)
          mesg.value = `登录失败: ${err}`
          loginReady.value = false
          resolve({ result: false, mesg: '免登失败' })
        }
      })

      // dd.error — 签名失败时静默，继续尝试免登
      dd.error((err: { errorCode?: string } | unknown) => {
        if (settled) return
        const code = (err as { errorCode?: string })?.errorCode
        console.warn('⚠️ dd.error code:', code)
        // 签名失败时不阻塞，dd.ready 在非白名单域名可能不触发
        // 直接尝试免登（requestAuthCode 不需要鉴权）
      })

      // 尝试 dd.config（可能失败，但不影响免登）
      try {
        dd.config({
          agentId: '1489417393',
          corpId: res.corpId,
          timeStamp: res.timestamp,
          nonceStr: res.nonce_str,
          signature: res.msg,
          jsApiList: [
            'writeNFC', 'chooseImage', 'getLocation', 'editPicture',
            'biz.contact.choose', 'device.notification.confirm',
            'device.notification.alert', 'device.notification.prompt',
            'biz.ding.post', 'biz.util.openLink',
          ],
        })?.catch?.(() => { /* 签名失败静默 */ })
      } catch { /* 签名失败静默 */ }

      // 超时兜底：3 秒后如果还没 settled，直接免登
      setTimeout(async () => {
        if (settled) return
        console.warn('⏰ dd.ready 超时，直接免登')
        try {
          const result = await doDingLogin()
          settled = true
          console.log('✅ 超时兜底免登成功:', result)
          resolve({ result: true, mesg: '超时兜底' })
        } catch (err) {
          settled = true
          console.error('❌ 兜底免登也失败:', err)
          loginReady.value = false
          resolve({ result: false, mesg: '登录失败' })
        }
      }, 3000)
    })
  }

  async function logout() {
    await dd.util.domainStorage.removeItem({
      name: 'workLoad',
    }).catch(() => {})
    localStorage.removeItem('workLoad_token')
    localStorage.removeItem('workLoad_user')
    loginReady.value = false
    userInfo.value = {
      depart: '',
      depid: '',
      position: '',
      userid: '',
      username: '',
      rank: 0,
      token: '',
      avatar: '',
      mobile: '',
    }
    window.location.reload()
  }

  function refreshPage() {
    location.reload()
  }

  return {
    token,
    userInfo,
    login,
    permissions,
    permission_list,
    userRank,
    fetchUserRank,
    logout,
    refreshPage,
    loginReady,
    mqttReady,
  }
})
