import { defineStore } from 'pinia'
import { getProject, type ProjectNode } from '@/axios/interface'

interface TreeNode {
  id: number
  label: string
  value: string
  children?: TreeNode[]
}

function buildTree(nodes: ProjectNode[]): TreeNode[] {
  const map = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  // 创建副本，parent 字段不传给 a-tree-select（期望 Object 而非 number）
  for (const n of nodes) {
    map.set(n.id, { id: n.id, label: n.label, value: n.value, children: [] })
  }
  // 建立父子关系
  for (const n of nodes) {
    const node = map.get(n.id)!
    if (n.parent && map.has(n.parent)) {
      map.get(n.parent)!.children!.push(node)
    } else {
      roots.push(node)
    }
  }
  // 清理空 children
  for (const node of map.values()) {
    if (node.children!.length === 0) {
      delete node.children
    }
  }
  return roots
}

export const useAppCacheStore = defineStore('appCache', () => {
  const currentProject = ref<number>(-1)
  const projectList = ref<TreeNode[]>([])
  const loaded = ref(false)

  /** 从后端获取部门 — GET /api/publicMesg/getProject */
  async function fetchProjectList() {
    if (loaded.value) return
    try {
      const res = await getProject()
      if (Array.isArray(res)) {
        const tree = buildTree(res)
        projectList.value = tree
        loaded.value = true
        console.log('📋 部门树:', tree)
        // 默认选中第一个根节点
        if (tree.length > 0 && currentProject.value === -1) {
          currentProject.value = tree[0]!.id
        }
      }
    } catch {
      console.warn('获取部门列表失败')
    }
  }

  /** 当前选中的部门名称 */
  const currentProjectName = computed(() => {
    const find = (nodes: TreeNode[]): string | null => {
      for (const n of nodes) {
        if (n.id === currentProject.value) return n.label
        if (n.children) {
          const r = find(n.children)
          if (r) return r
        }
      }
      return null
    }
    return find(projectList.value) || '选择部门'
  })

  return {
    currentProject,
    projectList,
    loaded,
    currentProjectName,
    fetchProjectList,
  }
})
