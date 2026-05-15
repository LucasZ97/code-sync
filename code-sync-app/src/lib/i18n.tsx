/**
 * i18n — lightweight translation context.
 * Supports: 'en' (English) and 'zh' (Chinese Simplified).
 *
 * Usage:
 *   const { t, lang, setLang } = useI18n()
 *   t('push.title')  →  "Push" | "推送"
 */

import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

export type Lang = 'en' | 'zh'

// ── Translation strings ───────────────────────────────────────────────────────

const translations = {
  en: {
    // App
    'app.name': 'CodeSync',

    // TopBar
    'topbar.project': 'Project',
    'topbar.server': 'Server',
    'topbar.no_projects': '— no projects —',
    'topbar.no_servers': '— no servers —',
    'topbar.settings': 'Settings',
    'topbar.manage_servers': 'Manage Servers',
    'topbar.manage_projects': 'Manage Projects',

    // Sidebar
    'nav.push': 'Push',
    'nav.pull': 'Pull',
    'nav.history': 'History',
    'nav.diff': 'Diff',

    // PushPanel
    'push.title': 'Changed Files',
    'push.refresh': '↻ Refresh',
    'push.select_all': 'Select All',
    'push.deselect_all': 'Deselect All',
    'push.loading': 'Loading…',
    'push.empty_title': 'Working tree clean',
    'push.empty_desc': 'No staged or unstaged changes detected.',
    'push.selected': 'selected',
    'push.button': '↑ Push',
    'push.no_project': 'Select a project first',
    'push.no_server': 'Select a server first',
    'push.no_files': 'Select files to push',
    'push.tooltip': 'Generate patch and upload to server',

    // PullPanel
    'pull.title': 'Server Patches',
    'pull.refresh': '↻ Refresh',
    'pull.empty_title': 'No patches on server',
    'pull.empty_desc': 'Push a patch from another machine first, then refresh.',
    'pull.refresh_list': '↻ Refresh List',
    'pull.button': '↓ Pull',

    // HistoryPanel
    'history.title': 'Sync History',
    'history.refresh': '↻ Refresh',
    'history.empty_title': 'No history yet',
    'history.empty_desc': 'Push or pull patches to see activity here.',
    'history.files': 'file',
    'history.files_plural': 'files',
    'history.via': 'via',

    // DiffPanel
    'diff.title': 'Diff Viewer',
    'diff.no_diff': 'No diff loaded',
    'diff.no_diff_desc': "Click 'Load Last Patch' to view the most recently generated or applied patch.",
    'diff.load': 'Load Last Patch',
    'diff.unified': 'Unified',
    'diff.split': 'Split',
    'diff.conflicts': 'conflict',
    'diff.conflicts_plural': 'conflicts',
    'diff.conflict_msg': 'Patch applied with conflicts — resolve .rej files manually.',
    'diff.no_content': 'No diff content to display.',

    // LogPanel
    'log.title': 'Logs',
    'log.clear': 'Clear',
    'log.empty': 'No log entries yet.',

    // SetupWizard
    'wizard.title': 'Welcome to CodeSync',
    'wizard.step': 'Step',
    'wizard.of': 'of',
    'wizard.step1_label': 'Local Project',
    'wizard.step2_label': 'Remote Server',
    'wizard.project_name': 'Project Name',
    'wizard.local_path': 'Local Repo Path',
    'wizard.server_name': 'Server Name',
    'wizard.host': 'Host',
    'wizard.port': 'Port',
    'wizard.username': 'Username',
    'wizard.remote_dir': 'Remote Base Dir',
    'wizard.tunnel_hint': 'Ensure your SSH tunnel is active before connecting. Example: ssh -L 9000:target:22 bastion',
    'wizard.back': '← Back',
    'wizard.skip': 'Skip',
    'wizard.next': 'Next →',
    'wizard.save': 'Save & Start',

    // ServerManager
    'server.manager_title': 'Manage Servers',
    'server.manager_desc': 'Add, edit, or remove server connections.',
    'server.empty': 'No servers configured.',
    'server.add': '+ Add Server',
    'server.edit': 'Edit',
    'server.delete': 'Delete',
    'server.delete_confirm': 'Delete server',
    'server.name': 'Server Name',
    'server.host': 'Host',
    'server.port': 'Port',
    'server.username': 'Username',
    'server.remote_dir': 'Remote Base Dir',
    'server.save': 'Save',
    'server.cancel': 'Cancel',

    // ProjectManager
    'project.manager_title': 'Manage Projects',
    'project.manager_desc': 'Add, edit, or remove projects.',
    'project.empty': 'No projects configured.',
    'project.add': '+ Add Project',
    'project.edit': 'Edit',
    'project.delete': 'Delete',
    'project.delete_confirm': 'Delete project',
    'project.name': 'Project Name',
    'project.path': 'Local Repo Path',
    'project.server': 'Default Server',
    'project.syncignore': 'Syncignore Path',
    'project.encoding': 'Source Encoding Hint',
    'project.save': 'Save',
    'project.cancel': 'Cancel',

    // ConflictViewer
    'conflict.title': 'Conflicts',
    'conflict.rej': '.rej file',
    'conflict.rej_plural': '.rej files',
    'conflict.copy': 'Copy',
    'conflict.copied': '✓ Copied',
    'conflict.banner': 'Patch applied with conflicts. The hunks below could not be applied automatically. Resolve them manually, then delete the .rej files.',
  },

  zh: {
    // App
    'app.name': 'CodeSync',

    // TopBar
    'topbar.project': '项目',
    'topbar.server': '服务器',
    'topbar.no_projects': '— 暂无项目 —',
    'topbar.no_servers': '— 暂无服务器 —',
    'topbar.settings': '设置',
    'topbar.manage_servers': '管理服务器',
    'topbar.manage_projects': '管理项目',

    // Sidebar
    'nav.push': '推送',
    'nav.pull': '拉取',
    'nav.history': '历史',
    'nav.diff': '差异',

    // PushPanel
    'push.title': '变更文件',
    'push.refresh': '↻ 刷新',
    'push.select_all': '全选',
    'push.deselect_all': '取消全选',
    'push.loading': '加载中…',
    'push.empty_title': '工作区干净',
    'push.empty_desc': '未检测到已暂存或未暂存的变更。',
    'push.selected': '已选',
    'push.button': '↑ 推送',
    'push.no_project': '请先选择项目',
    'push.no_server': '请先选择服务器',
    'push.no_files': '请选择要推送的文件',
    'push.tooltip': '生成补丁并上传到服务器',

    // PullPanel
    'pull.title': '服务器补丁',
    'pull.refresh': '↻ 刷新',
    'pull.empty_title': '服务器上暂无补丁',
    'pull.empty_desc': '请先从其他机器推送补丁，然后刷新。',
    'pull.refresh_list': '↻ 刷新列表',
    'pull.button': '↓ 拉取',

    // HistoryPanel
    'history.title': '同步历史',
    'history.refresh': '↻ 刷新',
    'history.empty_title': '暂无历史记录',
    'history.empty_desc': '推送或拉取补丁后，此处将显示操作记录。',
    'history.files': '个文件',
    'history.files_plural': '个文件',
    'history.via': '策略',

    // DiffPanel
    'diff.title': '差异查看器',
    'diff.no_diff': '未加载差异',
    'diff.no_diff_desc': '点击"加载最新补丁"查看最近生成或应用的补丁。',
    'diff.load': '加载最新补丁',
    'diff.unified': '统一视图',
    'diff.split': '分栏视图',
    'diff.conflicts': '处冲突',
    'diff.conflicts_plural': '处冲突',
    'diff.conflict_msg': '补丁应用时存在冲突，请手动解决 .rej 文件。',
    'diff.no_content': '无差异内容可显示。',

    // LogPanel
    'log.title': '日志',
    'log.clear': '清空',
    'log.empty': '暂无日志。',

    // SetupWizard
    'wizard.title': '欢迎使用 CodeSync',
    'wizard.step': '第',
    'wizard.of': '步，共',
    'wizard.step1_label': '本地项目',
    'wizard.step2_label': '远程服务器',
    'wizard.project_name': '项目名称',
    'wizard.local_path': '本地仓库路径',
    'wizard.server_name': '服务器名称',
    'wizard.host': '主机地址',
    'wizard.port': '端口',
    'wizard.username': '用户名',
    'wizard.remote_dir': '远程基础目录',
    'wizard.tunnel_hint': '连接前请确保 SSH 隧道已建立。示例：ssh -L 9000:target:22 bastion',
    'wizard.back': '← 上一步',
    'wizard.skip': '跳过',
    'wizard.next': '下一步 →',
    'wizard.save': '保存并开始',

    // ServerManager
    'server.manager_title': '管理服务器',
    'server.manager_desc': '添加、编辑或删除服务器连接。',
    'server.empty': '暂无服务器配置。',
    'server.add': '+ 添加服务器',
    'server.edit': '编辑',
    'server.delete': '删除',
    'server.delete_confirm': '删除服务器',
    'server.name': '服务器名称',
    'server.host': '主机地址',
    'server.port': '端口',
    'server.username': '用户名',
    'server.remote_dir': '远程基础目录',
    'server.save': '保存',
    'server.cancel': '取消',

    // ProjectManager
    'project.manager_title': '管理项目',
    'project.manager_desc': '添加、编辑或删除项目。',
    'project.empty': '暂无项目配置。',
    'project.add': '+ 添加项目',
    'project.edit': '编辑',
    'project.delete': '删除',
    'project.delete_confirm': '删除项目',
    'project.name': '项目名称',
    'project.path': '本地仓库路径',
    'project.server': '默认服务器',
    'project.syncignore': 'Syncignore 路径',
    'project.encoding': '源文件编码提示',
    'project.save': '保存',
    'project.cancel': '取消',

    // ConflictViewer
    'conflict.title': '冲突',
    'conflict.rej': '个 .rej 文件',
    'conflict.rej_plural': '个 .rej 文件',
    'conflict.copy': '复制',
    'conflict.copied': '✓ 已复制',
    'conflict.banner': '补丁应用时存在冲突，以下代码块无法自动应用，请手动解决后删除 .rej 文件。',
  },
} as const

export type TranslationKey = keyof typeof translations.en

// ── Context ───────────────────────────────────────────────────────────────────

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'codesync-lang'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return (stored === 'zh' || stored === 'en') ? stored : 'en'
  })

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLangState(next)
  }, [])

  const t = useCallback((key: TranslationKey): string => {
    return translations[lang][key] ?? translations.en[key] ?? key
  }, [lang])

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
