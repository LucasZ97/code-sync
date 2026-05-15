# CodeSync 功能范围文档

> **用途**：本文件是 CodeSync 应用的功能开发边界和开发依据。
> Claude Code 读取本文件后，依据其中的功能定义进行开发。
> 你可以直接修改本文件中的功能描述、约束条件，或在末尾新增功能需求。
>
> **格式约定**：
> - `[已实现]` — 功能已完成，不需要重新开发
> - `[待实现]` — 功能尚未开发，Claude Code 应主动实现
> - `[修改]` — 已有实现但需要调整，修改说明写在条目下方
> - `[禁止]` — 明确不做的功能，Claude Code 不应实现

---

## 一、应用定位

CodeSync 是一个跨平台（macOS / Windows）的 Git 代码同步工具，桌面端基于 Tauri 构建（Rust 后端 + React 前端）。

**核心场景**：开发者在本地（macOS/Windows）编写代码，通过 SSH 隧道将 Git patch 上传到 Linux 中继服务器，另一台机器从服务器拉取 patch 并应用到本地仓库，实现双向代码同步，无需 Git remote 权限。

**技术栈**：
- 前端：React 19 + TypeScript + Tailwind CSS 4 + Vite
- 后端：Rust + Tauri 2 + Tokio
- SSH：russh 0.45 + russh-sftp 2.x
- 存储：TOML 配置 + SQLite 历史记录

---

## 二、核心功能模块

### 2.1 项目管理

**[已实现]** 多项目配置
- 支持配置多个本地 Git 仓库项目
- 每个项目关联一个 SSH 连接
- 项目信息：名称、本地仓库路径、关联连接 ID、syncignore 路径、编码提示

**[已实现]** 首次运行向导（SetupWizard）
- Step 1：配置项目（名称、本地仓库路径）
- Step 2：配置服务器（名称、主机、端口、用户名、远程基础目录）
- 无项目时自动弹出

**[已实现]** 顶栏项目切换
- 下拉选择当前活跃项目
- 显示当前项目的本地路径

---

### 2.2 SSH 连接管理

**[已实现]** 多服务器连接配置
- 支持配置多个 SSH 连接
- 连接信息：名称、主机、端口、用户名、远程基础目录

**[已实现]** 连接认证（按顺序尝试）
1. `none` 认证（无密码隧道场景）
2. SSH Agent（`SSH_AUTH_SOCK`）
3. 默认密钥文件：`~/.ssh/id_ed25519`、`~/.ssh/id_ecdsa`、`~/.ssh/id_rsa`

**[已实现]** TOFU 主机密钥验证
- 首次连接自动信任并保存指纹到 `~/.config/codesync/known_hosts.json`
- 后续连接比对指纹，不匹配则拒绝连接

**[已实现]** 连接测试
- 执行 `echo codesync-ok` 验证连通性
- 顶栏显示连接状态指示灯（绿/红）

**[已实现]** 连接管理界面（ServerManager）
- 增删改服务器连接
- 每个连接独立测试按钮

**[禁止]** 密码认证 — 不支持 SSH 密码登录，仅支持密钥和 none 认证

---

### 2.3 推送（Push）

**[已实现]** Git 状态获取
- 运行 `git status --porcelain -uall -z` 解析文件状态
- 状态分类：staged（已暂存）、unstaged（未暂存）、untracked（未追踪）
- 支持重命名/复制文件的正确解析

**[已实现]** 文件选择
- 复选框逐个选择文件
- 全选 / 取消全选按钮
- 显示已选文件数量

**[已实现]** Patch 生成
- 基于选中文件生成 unified diff patch
- 过滤 filemode-only 变更（Windows 噪音）
- 注入 `CODESYNC-META` 头（project_id、base_commit、base_commit_msg、files_changed、sha256、timestamp）
- 编码归一化：自动检测 GBK / UTF-16 / BOM，转换为 UTF-8
- Windows 路径兼容性检查（保留名、非法字符、MAX_PATH 260 字符限制）
- 生成 SHA256 校验值
- Patch 文件命名：`{uuid}-{date}-{project_id}-{short_commit}.codesync`
- 本地存储路径：`~/.config/codesync/patches/`

**[已实现]** Patch 上传（SFTP）
- 远程目录结构：`{remote_base_dir}/{project_id}/{username}/`
- 原子写入：先写 `.tmp` 文件，校验 SHA256 后重命名
- 内容去重：远程已存在相同 SHA256 的文件则跳过上传
- 上传成功后记录历史

**[已实现]** 进度显示
- 分阶段进度条：生成中 → 上传中 → 完成
- 底部日志面板实时输出

---

### 2.4 拉取（Pull）

**[已实现]** 远程 Patch 列表
- 列出服务器上 `{remote_base_dir}/{project_id}/{username}/` 目录下的 `.codesync` 文件
- 显示：文件名、大小、修改时间
- 按文件名倒序排列（最新在前）

**[已实现]** Patch 下载（SFTP）
- 下载到本地 `~/.config/codesync/patches/`
- SHA256 完整性校验，校验失败则删除本地文件并报错

**[已实现]** Patch 应用（多策略回退）
按顺序尝试以下策略，成功则停止：
1. `git apply` — 标准应用
2. `git apply --ignore-whitespace` — 忽略空白差异
3. `git apply --3way` — 三路合并
4. `patch -p1` — 系统 patch 命令
5. `git apply --reject` — 强制应用，冲突写入 `.rej` 文件

**[已实现]** 冲突处理
- 显示冲突文件列表
- 显示 `.rej` 文件路径
- 历史记录标记为 `partial`

**[已实现]** 进度显示
- 分阶段进度条：下载中 → 应用中 → 完成

---

### 2.5 历史记录

**[已实现]** 同步历史存储
- SQLite 数据库：`~/.config/codesync/history.db`
- 每次推送/拉取后自动记录

**[已实现]** 历史记录字段
- 操作方向（push / pull）
- Patch 文件名
- 基准 commit（短 hash）
- 变更文件数
- 应用策略（仅 pull 有）
- 状态（success / partial / failed）
- 时间戳

**[已实现]** 历史列表展示
- 按时间倒序，最多显示 100 条
- 方向图标（↑ push / ↓ pull）
- 状态徽章（颜色区分）

---

### 2.6 Diff 可视化

**[已实现]** Patch 内容查看
- 加载最近一次生成的 patch 内容
- 统一视图（line-by-line）
- 并排视图（side-by-side）
- 基于 diff2html 渲染，支持语法高亮

**[已实现]** 冲突文件查看
- 显示 `.rej` 文件列表及内容

---

### 2.7 配置持久化

**[已实现]** 配置文件
- 路径：`~/.config/codesync/config.toml`
- 格式：TOML
- 内容：版本号、连接列表、项目列表、patch 保留天数

**[已实现]** Syncignore
- 类 gitignore 语法的忽略规则文件
- 生成 patch 时过滤匹配的文件
- 基于 globset 实现高效匹配

---

### 2.8 国际化

**[已实现]** 中英文切换
- 顶栏一键切换 EN / 中
- 覆盖所有 UI 文本

---

## 三、非功能性要求

### 安全
- SSH 连接必须经过 TOFU 主机密钥验证
- Patch 文件路径必须限制在 `~/.config/codesync/patches/` 内（防路径穿越）
- 不在代码中硬编码任何凭据

### 可靠性
- SFTP 上传使用原子写入（`.tmp` + rename）
- Patch 应用有 5 级回退策略
- 上传/下载均有 SHA256 完整性校验
- SSH 连接失败支持指数退避重试

### 性能
- SSH 连接池复用，避免每次操作重新握手
- Patch 内容去重（SHA256），避免重复上传

### 用户体验
- 所有耗时操作显示进度条和阶段说明
- 底部日志面板保留最近 200 条操作日志
- 错误信息明确指向具体失败原因

---

## 四、数据存储位置汇总

| 数据 | 路径 | 格式 |
|------|------|------|
| 应用配置 | `~/.config/codesync/config.toml` | TOML |
| 已知主机 | `~/.config/codesync/known_hosts.json` | JSON |
| 本地 Patch | `~/.config/codesync/patches/` | `.codesync` 文件 |
| 同步历史 | `~/.config/codesync/history.db` | SQLite |

---

## 五、Patch 文件格式

```
CODESYNC-META: {"project_id":"...","base_commit":"abc1234","base_commit_msg":"...","files_changed":3,"sha256":"...","timestamp":"2026-05-07T10:00:00Z"}
--- a/path/to/file.ts
+++ b/path/to/file.ts
@@ ... @@
 context line
-removed line
+added line
```

---

## 六、待实现 / 新增功能需求

> 在此区域添加新功能需求，Claude Code 会依据此处内容进行开发。
> 格式示例：
>
> ### F-001 功能名称
> **优先级**：高 / 中 / 低
> **描述**：...
> **验收标准**：
>
> - [ ] 条件1
> - [ ] 条件2

<!-- 在此处添加新功能需求 -->

F-001 多项目多linux服务器配置

优先级：高

描述：APP支持多linux服务器、多项目关联。主要以项目为主，用户可以添加/修改/删除项目，可以在APP主页面切换项目。可以在主界面切换服务器。上传的patch文件必须带有项目名、日期等标识，方便用户区分。主界面左下角的测试连接要去掉，影响美观； 在拉取的时候可以识别某项目在某服务器上的patch文件并展示在列表中。
