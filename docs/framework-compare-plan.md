# framework-compare 开发方案

> 日期:2026/05/08  |  状态:Phase 1 已完成 ✅ (2026/05/10)  |  读者:实施者本人 + 未来协作者

## 〇、文档性质

本文是**项目的需求与方案**,不是对比结论。交付物是代码仓库 + 自动化报告,不是一篇预先写死数字的文章——真实数字由本地 runner 产出。

## Phase 1 完成状态 (2026/05/10)

**已交付**:

- [x] Bun workspace 骨架 (`apps/`、`simple-bench/`、`packages/`、`bench/`、`metrics/`、`report/`)
- [x] 四端 simple-bench 应用:`react-list` / `svelte-list` / `imba-list` / `ripple-list`,各自暴露 `window.__simpleBench` 统一接口
- [x] `bench/runner.mjs`:Playwright + `performance.now`,10 次采样丢首次,`--expose-gc`
- [x] `bench/aggregate.mjs`:P50 / P95 / IQR 汇总到 `metrics/summary.json`
- [x] `report/render.mjs`:静态 HTML 报告(表格 + SVG 条形图 + 环境指纹 + JSON 下载)
- [x] `report/render.mjs`:本地 render 后写入 `docs/`,由 GitHub Pages 的 `main` / `docs` 自动部署
- [x] `VERSIONS.md`:版本锁 + Ripple 0.3.x 接入笔记(插件 named import、`.tsrx` 扩展名)
- [x] 本地四端 `vite build` / `imba build` 全部通过

**Phase 1 范围之外(待后续展开)**:ProjectOps 业务应用、复杂业务 bench、LOC/心智成本度量、shared-e2e。

## 目录

- [一、目标与范围](#一目标与范围)
- [二、仓库与技术栈](#二仓库与技术栈)
- [三、业务规约 ProjectOps](#三业务规约-projectops)
- [四、性能基准方案](#四性能基准方案)
- [五、代码量与心智成本](#五代码量与心智成本)
- [六、里程碑、风险、验收](#六里程碑风险验收)
- [七、下一步](#七下一步)

---

## 一、目标与范围

### 1.1 一句话

**用同一个复杂中后台业务 ProjectOps 在 React / Svelte 5 / Imba / Ripple 各实现一遍,同时保留一套简单列表基准,由本地 runner 采集性能、包体、代码量、心智成本,产出可复现报告。**

### 1.2 动机

- 现有框架对比要么只跑 todomvc(太简单),要么只比 hello world 包体(不现实)。
- 我们要回答:做一个**像样的业务**时,四个框架各自的代价是什么。
- 给未来选型留一份**可复现、可挑战**的一手数据,而不是拍脑袋。

### 1.3 成功标准

| 维度 | 口径 | 工具 |
|------|------|------|
| 复杂业务性能 | ProjectOps 工作流 P50 / P95 | Playwright + `performance.now()` |
| 简单性能 | 1k / 10k 行的创建/更新/选择/交换/删除 P50 / P95 | 同上 |
| 内存 | 初始与交互后 JS heap | `performance.memory` / CDP `Memory.getDOMCounters` |
| 包体 | `dist/` 全量 gzip + brotli | `gzip-size`, `brotli-size` |
| 代码量 | 业务 LOC / simple-bench LOC / shared CSS LOC 分列 | `cloc --json` |
| 编译速度 | dev 冷启动、prod build 墙钟 | `bun run` + `hyperfine` |
| 心智成本 | 关键业务点的模板代码片段长度 | 手工抽样 |

**非目标**:不输出"谁最好"的总排名,只输出多维数据,由读者按权重自行判断。

### 1.4 边界

- **In**:4 个 ProjectOps 应用、1 套简单性能基准、1 套复杂业务 benchmark、自动生成的报告、本地部署脚本。
- **Out**:SSR / SEO、移动端、长期维护性调研、招聘市场分析。

---

## 二、仓库与技术栈

### 2.1 目录

```
framework-compare/
├── apps/                     # 四端 ProjectOps 业务应用
│   ├── react-projectops/     # React 19 + Vite + Zustand + React Router
│   ├── svelte-projectops/    # Svelte 5 (runes) + Vite + SvelteKit 子集
│   ├── imba-projectops/      # Imba 2 + 官方预设
│   └── ripple-projectops/    # Ripple + TSRX + @ripple-ts/vite-plugin
├── simple-bench/             # 简单列表基准,非业务
│   └── {react,svelte,imba,ripple}-list/
├── packages/
│   ├── shared-spec/          # 业务 SPEC:TS 类型、mock、校验器
│   ├── shared-e2e/           # Playwright 脚本(四端共用断言)
│   ├── shared-ui-tokens/     # 颜色/间距 token
│   └── shared-styles/        # reset、主题、基础 class(单独计量)
├── bench/
│   ├── complex/              # ProjectOps 场景
│   ├── simple/               # list create/update/select/swap/clear
│   ├── runner.mjs            # 启动 → 采样 → 写 JSON
│   └── aggregate.mjs         # 多次采样取 P50 + IQR
├── metrics/
│   ├── bundle-size.mjs       # gzip + brotli
│   ├── loc.mjs               # cloc 包装
│   └── build-time.mjs        # hyperfine 包装
├── report/
│   ├── template.md.hbs       # Handlebars 模板
│   └── render.mjs            # 合并 metrics/*.json → README.md
├── package.json              # Bun workspaces + 根脚本
└── README.md                 # 由 render.mjs 自动覆写
```

### 2.2 工具链

- **包管理 / 脚本**:Bun workspaces,四端依赖彼此独立;统一 `bun install` / `bun run` / `bunx`。
- **构建**:由 Bun 驱动,应用实际走 Vite 7(Imba 用官方插件,Ripple 用 `@ripple-ts/vite-plugin`)。
- **语言**:TS 5.x;Imba 用自带语言能力;Ripple 用 TSRX。
- **测试 / E2E**:Bun 作统一入口,浏览器自动化用 Playwright 1.x(无头 Chromium,固定版本防抖动)。
- **部署**:本地生成 `docs/`,提交后由 GitHub Pages 的 `main` / `docs` 托管。
- **报告**:Bun 执行脚本合并 JSON → Markdown 表格 + Mermaid 雷达图。

### 2.3 版本锁

React / Svelte / Imba **必须**用各自 stable latest,写入 `VERSIONS.md` 并在报告中展示。Ripple 按官方推荐或 npm `latest` dist-tag 锁定;即使进入 1.x,也需标注"新项目 / 早期生态",并记录文档、插件、语法的迁移情况。

### 2.4 Bun 脚本约定

根 `package.json` 暴露统一入口,本地采集与部署均只调用 Bun:

| 命令 | 作用 |
|------|------|
| `bun install` | 安装依赖,生成/更新 `bun.lock` |
| `bun --filter <app> run dev` | 启动某个应用 |
| `bun run build` | 构建全部应用 |
| `bun run test` | 单元测试 + 规约测试 |
| `bun run e2e` | 跑 Playwright 用例 |
| `bun run bench:simple` | 简单列表基准 |
| `bun run bench:complex` | ProjectOps 复杂基准 |
| `bun run bench` | simple + complex + aggregate |
| `bun run metrics` | 采集包体 / LOC / build time |
| `bun run report:local` | build → bench → metrics:bundle → report:render |
| `bun run report:render` | 渲染 README 报告 |
| `bun run deploy` | 本地重新采集并写入 `docs/` |

Vite、Playwright、cloc、hyperfine 都由 Bun 脚本内部调用,不作为用户入口。若某插件暂不兼容 Bun runtime,脚本可显式调用对应 CLI,但入口仍保持 `bun run <script>`。

### 2.5 四端定位差异

四者不是同层级"同类框架",对比时要写清定位,避免把成熟生态与新项目按单维度排名。

| 对象 | 核心定位 | 响应式 / 渲染模型 | 关键区别 | 对本项目的影响 |
|------|----------|-------------------|----------|----------------|
| **React 19** | 成熟 UI 库,搭配路由/状态/数据层生态 | 组件函数 + Hooks;新增 Actions、`useActionState`、`useOptimistic`、`use` | 本体不提供文件级模板 DSL、scoped CSS、路由、全局状态;优势在生态、熟悉度、第三方库 | 作为"主流生态基线",允许 Zustand / React Router 等配套,但依赖成本要计入 |
| **Svelte 5** | 编译型 UI 框架,单文件组织模板/逻辑/样式 | 编译器 + runes(`$state` / `$derived` / `$effect`)的细粒度响应式 | 比 React 更多工作在编译期;比 Ripple 生态成熟;比 Imba 不必学新语言 | 必须用 runes,不回退 Svelte 4 风格;SvelteKit 只取路由/构建子集 |
| **Imba** | 面向 Web 的完整语言 + 框架,编译到 JS | 语言级 tag、样式与 Memoized DOM | 不是"TS/JS 上的 UI 层",而要学 Imba 语法与工具链;优势是语法极简、DOM/样式一体化 | LOC 可能显著更低,但要单独记录语言学习成本、编辑器支持、生态缺口 |
| **Ripple** | 2025 年后新项目,基于 TSRX 的 compiler-driven TS UI 框架 | `track` + lazy destructuring(如 `&[]`);模板内支持原生 `if` / `for` / `try` | 成熟度差异最大:项目新、API 与扩展名近期有迁移;定位是吸收 React / Solid / Svelte 优点 | 单独标注"早期生态代价":锁版本、记迁移笔记、记缺失库的自实现,不把生态缺口当成运行时问题 |

**结论**:Ripple 与其它三者有明显代际差异。React 19 / Svelte 5 已有大规模使用基础,Imba 项目历史较长、定位完整语言,Ripple 则聚焦 TSRX、细粒度响应式与 TS-first 体验,生态覆盖不能按 React / Svelte 标准假设。

---

## 三、业务规约 ProjectOps

业务规约是对比的"公平基线":四端**功能边界必须一致**,否则 LOC 与性能无可比性。规约固化在 `packages/shared-spec/`。

ProjectOps 是一个"项目协作 + 工单运营"工作台,模拟真实中后台复杂业务。它比 Todo 场景更能暴露框架在复杂状态、动态表单、长列表、拖拽、权限、实时事件和生态补位上的差异。

### 3.1 核心实体

1. **Project**:owner、members、status、startAt / endAt、health、budget
2. **Issue**:title、description、priority、status、assignee、reporter、tags、dueAt、sla、order
3. **User / Team**:权限、筛选、指派、在线状态
4. **Comment**:评论流,支持新增/编辑/删除、@用户、乐观插入
5. **ActivityLog**:操作日志,记录状态变更、字段修改、评论、附件事件
6. **Attachment**:附件元数据,模拟上传、删除、预览、失败重试
7. **Notification**:通知中心,未读数、批量已读、跳转关联工单

### 3.2 页面与工作流

1. **工作台首页**:统计卡片、趋势图、超时工单、我的待办、最近活动
2. **工单列表**:虚拟滚动、列配置、多条件筛选、分组、排序、批量改状态/指派/标签
3. **看板视图**:按状态分列、跨列拖拽、同列排序、乐观更新、失败回滚
4. **工单详情**:主信息、动态字段、评论流、活动日志、关联工单、附件
5. **新建 / 编辑**:动态字段、条件校验、级联选择、草稿保存、离开确认
6. **权限模式**:Admin / Manager / Member / Viewer 四角色,控制字段可见性与操作入口
7. **实时事件**:模拟 WebSocket 推送评论、状态、指派、在线用户
8. **冲突处理**:编辑期间收到远端变更,提示保留本地 / 接受远端 / 手工合并
9. **主题与布局**:light/dark、密度切换、侧边栏折叠、列宽记忆

### 3.3 数据与状态

- 初始 mock:20 项目、80 用户、12 团队、5,000 工单、20,000 活动日志、10,000 评论。
- 四端共用 `shared-spec/` 的类型、mock 生成器、权限规则、数据校验器。
- 持久化首选 IndexedDB;不支持则回退 localStorage;提供 `VITE_API_BASE` 时切换 REST mock server。
- 实时事件由统一脚本驱动(`window.__projectops.pushEvent(event)`),不接真实后端。
- 可共享"纯数据规约与 mock 生成器",但 UI 状态组织、派生状态、事件绑定、组件拆分**必须由各框架独立实现**。

### 3.4 CSS 与 UI 约束

- 共享 CSS:四端共用 `shared-ui-tokens/` 与 `shared-styles/`(reset、主题变量、布局、基础 class)。
- 共享 CSS **不计入**各端业务 LOC,但**计入**最终包体,并在报告中单独列出 `shared css` 体积。
- 不得共享跨框架 UI 组件,不得把业务 UI 做成 Web Components 复用——我们比较的是各框架自身的模板、状态、事件组织。
- DOM 结构不要求像素级一致,但**信息密度、交互入口、控件数量、关键 a11y 属性必须一致**。

### 3.5 测试口径

`packages/shared-e2e/` 一套 Playwright 用例,四端必须全部通过。覆盖:角色切换 → 列表筛选 → 列配置 → 批量操作 → 看板拖拽 → 编辑草稿 → 详情评论 → 实时推送 → 冲突处理 → 主题/密度 → 路由深链。这是**功能对齐的唯一判据**。

---

## 四、性能基准方案

性能分两层:**复杂业务性能**回答"真实中后台业务的整体代价",**简单性能**保留接近 js-framework-benchmark 的基础渲染/更新对比。报告必须分开呈现,不合成总分。

### 4.1 复杂业务性能(ProjectOps)

| 场景 ID | 操作 | 观测点 |
|---------|------|--------|
| `app-cold-open` | 打开首页,加载 5k 工单 + 统计 + 最近活动 | 首屏可交互时间、初始 JS heap |
| `issue-filter-heavy` | 列表叠加关键字、状态、负责人、标签、SLA 筛选 | 派生计算、列表 diff、筛选延迟 |
| `issue-bulk-update-200` | 选中 200 工单批量改状态/标签 | 批量更新、Toast、局部刷新 |
| `kanban-drag-cross-column` | 工单从 Doing 拖到 Review 并成功确认 | 拖拽延迟、跨列重排 |
| `kanban-drag-rollback` | 跨列拖拽后模拟 API 失败并回滚 | 乐观更新回滚成本 |
| `detail-comment-stream` | 详情页连续推送 50 评论 + 50 日志 | 嵌套组件更新、滚动稳定性 |
| `dynamic-form-edit` | 编辑动态字段 → 条件校验 → 草稿 → 提交 | 表单组织、校验与提交耗时 |
| `remote-conflict` | 编辑期间推送远端变更,走合并流程 | 本地/远端状态合并成本 |
| `role-switch` | Admin / Manager / Member / Viewer 切换 | 权限派生、显隐更新 |
| `theme-density-toggle` | light/dark + comfortable/compact 切换 | 全局状态与大页面样式重算 |

四端必须暴露同名 `window.__projectopsBench` hook(仅在 `import.meta.env.DEV || BENCH` 注入),用于 seed、推送事件、模拟失败、读取状态摘要。数据写入 `metrics/raw/complex/`。

### 4.2 简单性能(List Bench)

简单性能应用只实现一个列表页,**不含**业务逻辑、**不复用**业务组件。

| 场景 ID | 操作 | 观测点 |
|---------|------|--------|
| `create-100` | 创建 100 行 | 小规模创建成本,避免 1k/10k 掩盖固定开销 |
| `create-1k` / `create-10k` | 创建 1k / 10k 行(id、label、按钮) | 批量创建与首次渲染 |
| `replace-1k` | 已有 1k 行后替换为新的 1k 行 | keyed 全量替换 |
| `append-1k` | 已有 1k 行后追加 1k | 追加成本 |
| `append-1k-to-10k` | 已有 10k 行后追加 1k | 大表追加成本 |
| `update-every-10th` / `update-every-10th-10k` | 每隔 10 行更新 label | 细粒度更新 |
| `select-row` | 点击切换 selected 样式 | 单节点更新 |
| `swap-rows` | 第 2 行与第 998 行交换 | 列表重排 |
| `remove-row` | 删除中间一行 | keyed diff + 卸载 |
| `clear-1k` / `clear-10k` | 清空 1k / 10k 行 | 批量卸载 |

四端暴露同名 `window.__simpleBench` hook,数据写入 `metrics/raw/simple/`。Phase 1 的 CPU 场景对齐 [krausest/js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) 可直接迁移的 keyed duration 维度,并保留本项目的小规模固定开销探针。简单性能只解释"基础能力",**不能直接推导复杂业务选型**。

简单内存维度同样对齐 js-framework-benchmark 的 memory 系列,单独采集并在报告中与 CPU 结果分开展示:

| 场景 ID | 操作 | 观测点 |
|---------|------|--------|
| `ready` | 应用加载完成后不创建数据 | 运行时基线内存、DOM 节点 |
| `run-1k` | 创建 1k 行后强制 GC | 1k 行稳定态 heap / DOM |
| `update-1k-x5` | 1k 行连续更新 5 次后强制 GC | 更新后的残留内存 |
| `replace-1k-x5` | 1k 行连续替换 5 次后强制 GC | keyed 替换后的残留内存 |
| `repeated-clear-1k-x5` | 创建并清空 1k 行 5 次后强制 GC | 批量卸载后的残留内存 |

暂不在 Phase 1 混入 Lighthouse startup 指标。启动耗时、main thread work、TTI/TBT 适合新增 `bench/startup.mjs` 独立 suite,避免和同步 DOM 操作耗时混成一个分数。

### 4.3 采集流程

```
runner.mjs
  for framework in [react, svelte, imba, ripple]:
    for suite in [simple, complex]:
      app = suite == simple ? `${framework}-list` : `${framework}-projectops`
      for scenario in suite.scenarios:
        启动 bun --filter $app run preview
        Playwright 打开 → 预热 1 次 → 正式采样 10 次
        读 performance.now() 差值 + performance.memory
        写 metrics/raw/$suite/$framework-$scenario.jsonl
  aggregate.mjs → metrics/summary.json
```

**反抖动**:

- 固定 Chromium 版本;本地采集时尽量关闭重负载后台任务,必要时固定性能模式。
- 每次采样前 `gc()`(启动 `--js-flags=--expose-gc`)。
- 丢弃首次(JIT 预热),只报 **P50 / P95 / IQR**,不报 mean。
- 采集并发度 = 1。

### 4.4 其它指标

- **`metrics/bundle-size.mjs`**:遍历 `apps/*/dist` 与 `simple-bench/*/dist`,对每个 `.js/.css` 求 gzip + brotli;区分 ProjectOps / simple-bench / shared CSS / initial chunk / total。
- **`metrics/loc.mjs`**:调用 `cloc --json --vcs=git apps/*-projectops/src simple-bench/*/src`,取 `code`,排除 `*.d.ts` 与生成产物。
- **`metrics/build-time.mjs`**:调用 `hyperfine --warmup 1 --runs 5 "bun --filter <app> run build"`。

### 4.5 报告渲染

`bun run report:render` 执行 `report/render.mjs`,读所有 JSON,按模板输出:

- 复杂业务速览(P50/P95、内存、包体、业务 LOC)
- 简单性能表(各场景 P50/P95)
- 共享 CSS 体积与 LOC 附表
- 每场景柱状图(Mermaid `xychart-beta`)
- 各端关键片段对照(聚合自 `apps/*/README.snippets.md`)
- 环境指纹(Bun / Chromium 版本、commit SHA、runner 型号、采集时间)

输出为 `docs/index.html` 与 `docs/zh.html`,提交并推送后由 GitHub Pages 自动部署。

---

## 五、代码量与心智成本

### 5.1 LOC 规则

- **主对象**:`apps/<x>-projectops/src/**`,排除 `*.d.ts`、`vite.config.*`、类型桩。
- **简单性能**:`simple-bench/<x>-list/src/**`,**单独**统计,不并入业务 LOC。
- **共享 CSS**:`packages/shared-styles/**` + `packages/shared-ui-tokens/**` 统计为 `shared_css_loc`,**不计入**任一框架。
- 工具:`cloc --vcs=git --json`,取 `SUM.code`;按 `script / template / style / shared_css` 四类分列。
- 注释与空行不计(cloc 默认)。
- 禁止"为缩短行数而单行化",统一 `prettier --print-width 100`。
- 报告主图只展示业务 LOC;simple-bench 与 shared CSS 放附表。

### 5.2 心智成本抽样

挑 8 段"必写代码",在每端抽样并归档到 `docs/snippets/`:

1. 工单列表多条件筛选后的派生列表
2. 动态表单校验 + 草稿保存 + 提交
3. 看板跨列拖拽 + 乐观更新 + 失败回滚
4. 详情页评论流 + 活动日志实时推送
5. 权限角色切换后的字段/按钮显隐
6. 编辑冲突检测 + 本地/远端合并
7. 主题与密度切换并持久化
8. 列虚拟滚动(若生态无官方方案,记自实现行数)

每个片段记:LOC、是否需第三方库、是否用脱出机制(`useEffect` / `$effect` / `tick`)。

### 5.3 输出结构

`metrics/loc.mjs` 写入 `metrics/loc.json`:

```json
{
  "projectops": {
    "react":  { "total": 0, "script": 0, "template": 0, "style": 0, "deps": [] },
    "svelte": { "...": "..." },
    "imba":   { "...": "..." },
    "ripple": { "...": "..." }
  },
  "simple":  { "react": { "total": 0 }, "svelte": { "...": "..." } },
  "shared":  { "css": 0, "tokens": 0 }
}
```

报告用并排条形图呈现,**数字由本地 runner 填充,本文档不预判**。

---

## 六、里程碑、风险、验收

### 6.1 里程碑(6 周)

| 周 | 目标 | 产出 |
|----|------|------|
| W1 | 仓库骨架 + SPEC 冻结 + shared CSS + shared-e2e 骨架 | 可跑本地空壳流程 |
| W2 | simple-bench 四端打通 + React ProjectOps 核心工作流 | 基线 1 |
| W3 | Svelte 5 ProjectOps 打通 | 基线 2,首份复杂 bench |
| W4 | Imba ProjectOps 打通 | 三端对比可出 |
| W5 | Ripple ProjectOps 打通(生态缺失自补小工具并记代价) | 四端齐 |
| W6 | 报告模板、本地采集稳定性调优、文章化 README | v1.0 release |

### 6.2 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| Ripple API / 工具链变动 | 返工 | 锁版本,记 TSRX、插件、扩展名与迁移笔记,不追新 |
| Imba 缺组件(如 DnD) | LOC 膨胀 | 记为"生态代价",不视为不公平 |
| 本地 runner 抖动大 | 性能数据不可信 | 采样增至 20,固定采集机器与后台负载,必要时换专用机器 |
| 四端 UI 难以一致 | 可比性被质疑 | 只保功能 + token 一致,不追像素级 |
| 共享 CSS 掩盖差异 | LOC 误读 | CSS 单独计量;组件/DOM/状态/事件不得共享 |
| ProjectOps 过复杂,工期膨胀 | 难收敛 | SPEC 分 must/should;v1 只做 must,趋势图/附件预览用轻量 mock |
| 作者熟悉度不均 | 某端代码不地道 | release 前每端请社区熟手 review |

### 6.3 验收清单

- [ ] 四端全部通过 `shared-e2e` 用例 *(Phase 2)*
- [ ] `bench/simple` 与 `bench/complex` 在同一台本地机器连跑 3 次,P50 波动 < 10% *(Phase 1 只跑 simple,连跑稳定性待本地历史数据验证)*
- [x] `docs/index.html` 由 `render.mjs` 自动生成且表格可读 *(输出为 `docs/index.html`,经本地 summary 渲染验证)*
- [x] `VERSIONS.md` 列出所有框架与关键依赖版本
- [x] `bun install && bun run bench && bun run report:render` 一键可复现

---

## 七、下一步

1. **暂不写四端完整业务代码**。先冻结第三节 SPEC、搭好 Bun workspace、共享 CSS、simple-bench 四端空壳与 `shared-e2e`,让流水线先跑起来。
2. 本文档作为 proposal 先评审,确认后再拆 issue。
3. **待决策**:
   - 是否加 Vue 3 / SolidJS 作对照?(倾向:v1 不加,v1.1 再看。)
   - Ripple 是否值得单独写一篇"新项目 / 早期生态代价"报告?
   - ProjectOps 的趋势图、附件预览放进 v1 must,还是 v1.1 扩展?
