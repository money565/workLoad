import COS from 'cos-js-sdk-v5'
import { message } from 'ant-design-vue'
import { getCosTempToken } from '@/axios/interfaceLogin'

const Bucket = ref('')
const Region = ref('')
const cosInstance = ref<COS | null>(null)

export function useUpload() {
  async function initCos(): Promise<COS> {
    if (cosInstance.value) return cosInstance.value
    const res = await getCosTempToken()
    const r = res.result
    Bucket.value = r.Bucket
    Region.value = r.Region
    const cos = new COS({
      getAuthorization: (_options, callback) => {
        callback({
          TmpSecretId: r.tmpSecretId,
          TmpSecretKey: r.tmpSecretKey,
          SecurityToken: r.sessionToken,
          StartTime: r.startTime,
          ExpiredTime: r.expiredTime,
        })
      },
    })
    cosInstance.value = cos
    return cos
  }

  function generatePath(fileName?: string, basePath = ''): string {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const parts = [basePath, String(y), m, d].filter(Boolean)
    if (fileName) parts.push(fileName)
    return parts.join('/')
  }

  function getUrl(key: string): Promise<string> {
    return new Promise((resolve) => {
      if (!cosInstance.value) { resolve(''); return }
      cosInstance.value.getObjectUrl(
        { Bucket: Bucket.value, Region: Region.value, Key: key },
        (err: any, data: any) => { resolve(err ? '' : data.Url) },
      )
    })
  }

  function upload(file: File, key: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!cosInstance.value) { reject(new Error('COS 未初始化')); return }
      cosInstance.value.putObject(
        { Bucket: Bucket.value, Region: Region.value, Key: key, Body: file, StorageClass: 'STANDARD' },
        (err: any) => {
          if (err) { message.error(`${file.name} 上传失败`); reject(err); return }
          getUrl(key).then(resolve)
        },
      )
    })
  }

  function remove(key: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!cosInstance.value) { reject(new Error('COS 未初始化')); return }
      cosInstance.value.deleteObject(
        { Bucket: Bucket.value, Region: Region.value, Key: key },
        (err: any) => { if (err) reject(err); else resolve(key) },
      )
    })
  }

  return { initCos, upload, remove, getUrl, generatePath }
}
