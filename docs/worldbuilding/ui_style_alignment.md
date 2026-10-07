# 世界观设定 - 子界面 UI 风格对齐规范

历史界面（HistoryView）是本轮 UI 的参考实现。本规范把它已经落地的视觉语言抽取成
**可复制的类名与动效常量**，供种族 / 体系 / 政治 / 经济 / 共享外壳五个子界面逐一对齐，
避免每个界面各自发明一套风格。

参考实现（只读，本轮不改）：

- `frontend/src/components/Worldbuilding/HistoryView.tsx`（工具栏 + 空态）
- `frontend/src/components/Worldbuilding/HistoryView/EraContentPanel.tsx`（内容面板）
- `frontend/src/components/Worldbuilding/HistoryView/EventCard.tsx`（实体卡片）
- `frontend/src/components/Worldbuilding/HistoryView/config.ts`（`animationConfig` / `cardVariants`）
- `docs/worldbuilding/history_ui_design.md` §4 / §5
- `docs/worldbuilding/worldbuilding_ui_design.md` §8 视觉规范

不在范围内：地图 / 特殊模块正文、后端、数据契约、任何文案改写。

---

## 1. 两条硬约束（回归测试静态扫描，违反即失败）

1. **禁止 emoji 与装饰性箭头。** 码点 `U+1F000-1FAFF`、`U+2190-21FF`（含 `← ↑ → ↓ ↔`）、
   `U+2600-27BF`（含 `★ ✓ ✕ ⚠`）、`U+2B00-2BFF`、`U+FE0F` 一律不得出现在源码里。
   要表达方向或状态请用 Lucide 图标（`ArrowLeft` / `ArrowRight` / `ChevronDown` / `Check` ...）。
   安全字符：`·`（U+00B7）、`—`（U+2014）、`…`、`「」`、`（）`。
2. **图标只能来自 `lucide-react`**，不引入任何新依赖（`package.json` 不动）。

## 2. 不变量（原样保留，不许"顺手改好"）

- 所有 `data-testid`、`data-*` 属性、`aria-label`、`role` 原样保留。
- 任何会被 `textContent.includes(...)` / 按文字找按钮的用例命中的**用户可见文案不改字**。
  文案润色不在本轮范围；确实需要改时先问 Lead。
- 带 testid 的元素数量由数据决定，不得为了排版增删
  （`race-card`、`data-kind="subrace"`、`lineage-branch/node/edge`、`system-row`、
  `tier-node`、`codex-volume`、`economy-node-*`、`economy-edge-*`、`economy-lane-*`、
  `economy-legend`、`politics-view-tab-*`、`politics-kind-filter`、`empty-state`）。
- 不改 hooks、API 调用、查询键、状态机与业务分支。本轮只动视觉层：
  **类名、motion 包裹、容器层级、装饰元素**。
- 经济界面（`EconomyView/components|modals|config.ts|EconomyView.tsx`）不得出现 `emerald-*`；
  `ECONOMY_PALETTE` 的值不得改动（领域色固定 green / cyan）。

## 3. 设计令牌

### 3.1 圆角阶梯（同屏只用这四级）

| 用途 | 类名 |
|------|------|
| 工具栏按钮、分段控件单项、筛选 chip | `rounded-lg` / `rounded-full` |
| 输入框（含搜索框） | `rounded-xl` |
| 实体卡片 | `rounded-xl` |
| 内容面板 / 抽屉 | `rounded-2xl` |

### 3.2 字号阶梯（不再满屏 `text-[10px]` / `text-[11px]`）

| 用途 | 类名 |
|------|------|
| 视图标题 | `text-base font-semibold tracking-tight` |
| 工具栏按钮 / 分段控件 | `text-sm font-medium` |
| **一级实体卡标题**（模块主干实体） | `text-base font-semibold` 起；重要实体可到 `text-lg font-semibold tracking-tight` |
| **次级紧凑行 / 列表行标题** | `text-sm font-medium` |
| 三级 chip / 成员 / 徽章文字 | `text-xs` |
| 面板正文 | `text-sm leading-relaxed` |
| 元信息 / 副标题 / 描述 | `text-xs text-muted-foreground` |
| 计数徽章（唯一允许 10px 的地方） | `text-[10px]` |

**标题阶梯的依据**（HistoryView `LEVEL_CONFIG` 的 `titleSize`，逐级递减但**最小一档也是 `text-sm`**）：

| 层级 | HistoryView 取值 |
|------|------------------|
| 重点大事件 | `text-xl font-bold` |
| 大事件 | `text-lg font-semibold` |
| 普通事件 | `text-base font-medium` |
| 小事件（最低一档） | `text-sm font-medium` |

当年代表题标题是 `text-lg font-semibold`。所以：**不要把一级实体卡标题压到 `text-sm`**
——那会把模块主干的视觉权重拉到与小事件同级，反而更"简陋"。
层级由"卡片存在与否 + 面积 + 字号"共同表达（`worldbuilding_ui_design.md` §4.7、§8.3）。

### 3.2.1 例外：固定尺寸的画布 / SVG 密集位不参与字号阶梯

**不要**把 DOM 内容面的字号阶梯无差别套到"尺寸由布局常量固定 + `overflow-hidden`"的可视化盒上。
典型：`PoliticsView/PowerAtlas/PolityNode.tsx` 的节点卡（`atlasLayout` 固定 `width/maxWidth/height`）。
那里的徽章必须用**画布局部**的紧凑刻度（`text-[10px] px-1.5 py-0.5 whitespace-nowrap`），
而不是 DOM 内容面的 `chipClass`（`text-xs px-3 py-1`）——后者会让单个徽章宽于卡片内宽而被裁切。

同一口径已用于：`Chronicle/LaneRow` 轴刻度、`TreatyRibbonLayer` 的 SVG `<text>`、
`EconomyView/components/TimeBrush` 刻度、`config/WorldWeb` 画布节点标签。

判断方法：如果容器的宽高来自布局常量 / 数据映射而不是内容流，且带 `overflow-hidden`，
先量 `scrollWidth <= clientWidth` 再决定字号；**不要靠推算**。



### 3.3 留白

- 工具栏：`px-6 py-4`，控件之间 `gap-3`（分组之间 `gap-4`）。
- 内容区：外层 `px-6 py-6`；卡片网格 `gap-4`；面板内边距 `p-4`/`p-5`。
- 视图根容器不再用 `gap-2` 挤压工具栏和内容。

### 3.4 阴影

同屏最多两级：卡片 `shadow-sm`，hover 或浮层 `shadow-lg`（带色相，如 `shadow-primary/20`）。
不要给每个卡片都挂 `shadow-xl`。

## 4. 类名配方（逐字复制，这是"像历史界面"的关键）

### 4.1 工具栏外壳

HistoryView 的根容器自己滚动，所以它用 `sticky`。其他视图的根是
`flex h-full min-h-0 flex-col`，工具栏本来就是不滚动的 flex 子元素，
**去掉 `sticky top-0 z-20`，其余逐字保留**：

```
flex flex-wrap items-center gap-3 px-6 py-4
bg-gradient-to-b from-background via-background/95 to-background/90
backdrop-blur-md border-b border-border/20
```

（需要两侧分组时在该容器里用 `ml-auto` 分组，不要另起一层背景。）

### 4.2 工具栏次要按钮（多数入口，用 `motion.button`）

```tsx
<motion.button
  type="button"
  whileHover={{ scale: 1.01 }}
  whileTap={{ scale: 0.99 }}
  className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
>
```

### 4.3 工具栏主按钮（每个视图只留一个）

```tsx
className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/90 px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
```

`whileHover={{ scale: 1.02 }}`、`whileTap={{ scale: 0.98 }}`。

### 4.4 纯图标工具栏按钮（折叠栏、配置入口）

```tsx
className="rounded-lg border border-border/50 bg-muted/40 p-2 text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
```

`whileHover={{ scale: 1.05 }}`、`whileTap={{ scale: 0.95 }}`。

### 4.5 搜索框（保留现有 `ref` / `aria-label` / `data-testid`）

容器必须是 `relative group`，图标与清除按钮绝对定位：

```tsx
<div className="relative group">
  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
  <input
    className="w-full rounded-xl border border-border/40 bg-muted/30 py-2 pl-10 pr-9 text-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
  />
  {/* 有内容时： */}
  <motion.button
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-muted"
  >
    <X className="h-4 w-4 text-muted-foreground" />
  </motion.button>
</div>
```

宽度由外层容器给（`w-72` / `w-80` / `w-96`），不要写死在 input 上。
清除按钮用 `<AnimatePresence>` 包住。

### 4.6 分段控件（图鉴/血缘、阶梯/典籍、名册/编年/图集…）

历史界面用同类控件承载"时代切换"，这里是它的对齐版本：

```tsx
<div role="tablist" className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/30 p-1">
  <motion.button
    role="tab"
    aria-selected={active}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 motion-reduce:transition-none ${
      active ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
    }`}
  >
```

`role="tablist"` / `role="tab"` / `aria-selected` / `aria-pressed` 必须保留原语义与属性名。

### 4.7 筛选 chip（kind / 状态过滤）

```
rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 motion-reduce:transition-none
```

选中：`border-primary/40 bg-primary/10 text-primary shadow-sm`
未选中：`border-border/40 text-muted-foreground hover:border-border/70 hover:bg-accent/5 hover:text-foreground`

### 4.8 实体卡片

```
rounded-xl border border-border/50 bg-card/50 shadow-sm transition-all duration-300
```

hover：`hover:border-primary/25 hover:shadow-lg`（或领域色 `/30`），
配 `whileHover={{ y: -3 }}` + `transition={viewSpring}`。
卡片内部标题 `text-sm font-semibold`、元信息 `text-xs text-muted-foreground`、
hover 才出现的操作按钮用 `opacity-0 group-hover:opacity-100 transition-opacity duration-200`。

### 4.9 内容面板 / 抽屉

```
rounded-2xl border border-border/50 bg-card/40 shadow-sm backdrop-blur-sm
```

面板头（`px-5 py-4`）：标题 + `ml-auto` 操作组，用 `border-b border-border/30` 与正文分隔。
局部空态用 `border-2 border-dashed border-border/40` + `text-sm text-muted-foreground`。

### 4.10 富空态（历史界面的招牌元素）

共享件 `shared/EmptyState.tsx` 会升级成这个形态，用法不变；各视图**不要再自建一套**。
形态要点（顺序照抄）：

1. 外层 `flex flex-col items-center justify-center text-center gap-3 px-6 py-12`，
   保留 `data-testid="empty-state"`。
2. 图标托盘：`relative inline-flex h-20 w-20 items-center justify-center`，
   内层两圈渐变（`from-primary/20 via-accent/15 to-primary/20` 与 `/10`）+ 中心实心圆
   `h-12 w-12 rounded-full bg-gradient-to-br from-primary via-primary/90 to-accent shadow-lg shadow-primary/25`，
   图标 `h-6 w-6 text-primary-foreground`。
3. 标题 `text-lg font-semibold text-foreground`，描述 `text-xs text-muted-foreground max-w-md`。
4. 动作区 `flex flex-wrap justify-center gap-3`：
   主按钮用 4.3 的配方，次按钮用 4.2 的配方（尺寸放大到 `px-5 py-2.5`）。
5. 入场用 `cardVariants`（`initial="hidden" animate="visible"`），图标托盘加
   `initial={{ scale: 0.85, rotate: -8 }} animate={{ scale: 1, rotate: 0 }}`。

## 5. 动效

每个视图在自己的 `config.ts`（或视图文件顶部）声明一份**本视图的**常量，
从 `framer-motion` 引类型，值取自 `animationConfig`：

```ts
import type { Transition, Variants } from 'framer-motion';

export const viewSpring: Transition = { type: 'spring', stiffness: 280, damping: 28, mass: 0.85 };
export const viewSpringSnappy: Transition = { type: 'spring', stiffness: 380, damping: 26, mass: 0.8 };
export const viewEaseOut: Transition = { duration: 0.28, ease: [0.33, 1, 0.68, 1] };
export const viewItemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: viewSpring },
  exit: { opacity: 0, scale: 0.97, y: -10, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};
export const viewStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};
```

规则：

- **不复制 `filter: blur()`**：历史界面只渲染少量卡片，种族/经济会渲染几十上百张，
  每个卡片一次模糊滤镜会明显掉帧。用上面的 `viewItemVariants` 即可。
- 交错入场只给**首屏卡片网格**（`viewStagger` + `viewItemVariants`）；
  列表行、虚拟滚动列表、画布节点不加交错，只保留 hover 反馈。
- 视图根节点包一层 `<MotionConfig reducedMotion="user">`（`from 'framer-motion'`），
  尊重系统"减少动态效果"设置。
- 动效时长落在 150–300ms；缓动统一用上面三个常量，不要临时写别的曲线。
- 只给"用户动作的回应"加动画（打开、展开、切换、hover、确认）；
  不要每个区块都做入场动画。

## 6. 领域色（架构原则：chrome 用 primary，实体用领域色）

历史界面的做法是：**工具栏、按钮、搜索框一律走 `primary`（靛蓝）+ `muted` / `accent`**，
领域色只出现在实体层（时代主题渐变、等级徽章、选中态、卡片描边）。
其他界面照此办理，不要用领域色去染工具栏。

| 模块 | 实体层领域色 | 暗色取值 |
|------|--------------|----------|
| 种族 races | `teal-600` / `bg-teal-500/10` / `border-teal-500/30` | `teal-400` / `dark:text-teal-300` |
| 体系 systems | `violet-600` / `bg-violet-500/10` / `border-violet-500/30` | `violet-400` / `dark:text-violet-300` |
| 政治 politics | 沿用 `PoliticsView/tone.ts` 的 gold / red 映射 | 该文件已给出 |
| 经济 economy | 沿用 `ECONOMY_PALETTE`（green / cyan） | 该文件已给出 |

同一语义在全世界观内保持同一颜色（`worldbuilding_ui_design.md` §8.1）；
暗色模式单独取值，不做简单反色。

## 7. 每个视图的落地清单

1. 工具栏换成 4.1 的外壳；按钮换 4.2 / 4.3 / 4.4 配方；字号提到 `text-sm`。
2. 搜索框换 4.5 配方（保留 ref / aria-label / testid / 防抖逻辑）。
3. 分段控件换 4.6 配方；筛选 chip 换 4.7 配方。
4. 主内容容器换 4.9；卡片换 4.8（含 hover 抬升）。
5. 空态交给 `shared/EmptyState.tsx`（共享件负责人升级），视图内不自建。
6. 首屏卡片网格接 `viewStagger` + `viewItemVariants`；根节点包 `MotionConfig`。
7. 领域色按 §6 落到实体层，不要染工具栏。
8. 检查 1 / 2 节的硬约束与不变量。

## 8. 自检命令

```bash
cd frontend
node node_modules/@playwright/test/cli.js test tests/worldbuilding   # 39 条回归，必须全绿
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json       # 类型检查
```

回归用例通过只是地板：**类名是否与配方逐字一致**要靠人工比对，报告里要贴出关键片段。
