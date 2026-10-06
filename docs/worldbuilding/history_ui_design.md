# 世界观设定 - 历史界面 (HistoryView) UI 设计实现总结

> 配套阅读：`docs/worldbuilding/cross_module_link_design.md`（WorldLink 关联契约与全局规范）
> 本文为 v2.0：保留书卷式时间轴 UI，新增统一跨模块关联设计。

## 1. 概述与文件结构

### 1.1 项目定位

HistoryView 是 LocalScribe 世界观模块中 **历史模块** 的核心界面，用于管理世界的时间线、时代与事件。核心特性：

- **时代-事件二级结构**：时代（Era）包含多个事件（Event），事件可关联条目（EventItem）和人物
- **中国古典纪年**：支持"贞观元年"、"建安十三年"等中文时间表达
- **3D 卡片轮播**：创新的时代切换交互体验
- **人物与跨模块关联**：统一走 WorldLink（历史事件与时代可关联角色及任意模块实体）

### 1.2 文件结构

```
frontend/src/components/Worldbuilding/
├── HistoryView.tsx                          # 根组件 (719行) - 状态管理、数据获取、CRUD mutations
├── HistoryView/
│   ├── index.ts                              # 统一导出
│   ├── types.ts                              # 所有 TypeScript 类型定义 (249行)
│   ├── config.ts                             # 配置常量: 主题/类型/级别/动画/解析函数 (511行)
│   │
│   ├── EraSwitchContainer.tsx                # 时代切换容器 - 3D 卡片轮播 (436行)
│   ├── EraContentPanel.tsx                   # 时代内容面板 - 头部/描述/事件列表 (272行)
│   ├── EventCard.tsx                         # 事件卡片 - 核心 UI 单元 (621行)
│   ├── EraTimeline.tsx                       # 时间轴组件 - 左侧事件节点线 (134行)
│   ├── CharacterReference.tsx                # 人物引用区域 - 独立模式 (152行)
│   ├── TimelineTooltip.tsx                   # 时间轴悬浮提示 - Portal 渲染 (43行)
│   └── HistorySkeleton.tsx                   # 加载骨架屏 (49行)
│   │
│   └── modals/                               # 模态框目录
│       ├── index.ts                          # 模态框统一导出
│       ├── AddEraModal.tsx                   # 添加时代
│       ├── EditEraModal.tsx                  # 编辑时代
│       ├── AddEventModal.tsx                 # 添加事件
│       ├── EditEventModal.tsx                # 编辑事件
│       ├── AddItemModal.tsx                  # 添加条目
│       ├── EditItemModal.tsx                 # 编辑条目
│       ├── ConfigModal.tsx                   # 样式配置
│       └── CharacterPickerModal.tsx          # 人物选择器 (选择/快速创建)
│
└── (其他世界观组件...)

backend/app/
├── models/worldbuilding.py                   # SQLAlchemy ORM 模型 (206行)
│   World, WorldModule, WorldSubmodule, WorldModuleItem, WorldLink
│
└── api/v1/worldbuilding.py                   # FastAPI 路由 (2749行)

frontend/src/services/
└── worldbuildingApi.ts                       # API 客户端封装 (255行)

frontend/src/utils/
└── timeParser.ts                             # 中文时间解析 (481行)
```

---

## 2. 数据结构

### 2.1 前端 TypeScript 类型 (`types.ts`)

```typescript
// ===== 核心实体 =====

interface Era {
  id: string
  name: string                           // 时代名称
  description?: string                   // 时代描述
  startDate?: string                     // 世界内时间文本，来源 meta.time.start
  endDate?: string                       // 结束时间
  order_index: number                    // 排序索引
  theme?: string                        // 时代主题 id，来自 EraThemeConfig
}

interface Event {
  id: string
  name: string                           // 事件名称
  description?: string                   // 事件描述
  level: string                         // 事件级别 id，来自 EventLevelConfig
  eventDate?: string                    // 事件日期，来源 meta.time.start
  icon?: string                          // 自定义图标
  order_index: number
  eraId?: string                         // 所属时代 ID (parent_id)
  items: EventItem[]                     // 关联条目列表
  eventType?: string                    // 事件类型 id，来自 EventTypeConfig
}

interface EventItem {
  id: string
  name: string                           // 条目名称
  content: Record<string, string>         // 结构化内容 (KV 对)
  order_index: number
}

// ===== 类型别名（运行时来自 ModuleConfig） =====

type EventLevel = string   // 运行时来自 EventLevelConfig.id
type EraTheme = string   // 运行时来自 EraThemeConfig.id
type EventType = string   // 运行时来自 EventTypeConfig.id
// 说明：critical / major / normal / minor 仅为默认级别 id 示例，实际档数与名称由 EventLevelConfig 决定，可改名或删除。

// ===== 配置类型 =====

interface EraThemeConfig {
  label: string; labelCn: string          // 英/中文名
  gradient: string                        // Tailwind 渐变色类
  border: string                          // 边框色类
  accent: string                          // 强调色块类
  accentColor: string                     // CSS 颜色值
  text: string                           // 文字色类
  bgLight: string                         // 浅色模式 rgba
  bgDark: string                          // 深色模式 rgba
  description: string                     // 描述文案
}

interface EventTypeConfig {
  label: string; labelCn: string
  color: string                           // 主色调 hex
  gradient: string; border: string; accent: string; text: string
  icon: string                            // Lucide 图标名（kebab-case）
  description: string
}

interface EventLevelConfig {
  label: string; labelCn: string
  flexBasis: string                        // flex 基础宽度 (决定卡片大小)
  minHeight: string                        // 最小高度
  padding: string                          // 内边距
  bgClass: string                         // 背景渐变类
  borderClass: string                      // 边框类
  textClass: string                       // 文字色类
  titleSize: string                       // 标题字号
  icon: string                            // Lucide 图标名；等级用文字徽章加色阶，不用星号
  glowColor: string                       // 光晕颜色
  accentGradient: string                   // 强调渐变
}

interface HistoryModuleConfig {
  eraThemes: (EraThemeConfig & { id: string })[]
  eventTypes: (EventTypeConfig & { id: string })[]
  levels: (EventLevelConfig & { id: string })[]
}
```

### 2.2 后端数据库模型 (`worldbuilding.py`)

历史界面的数据映射到通用的世界观数据模型：

```
World (世界)
  └── WorldModule (module_type=history, config 存历史模块配置)  ← moduleId
        ├── WorldSubmodule (kind=era, parent_id=NULL)  → 前端 Era
        │     └── WorldSubmodule (kind=event, parent_id=eraId)  → 前端 Event
        │           └── WorldModuleItem (submodule_id=eventId)  → 前端 EventItem
        └── WorldLink (history.* 跨模块关联，独立存表)
```

**关键字段约定（不再使用 color/icon 前缀编码）：**

| 用途 | 存储字段 | 编码格式 | 示例 |
|------|---------|---------|------|
| 类型标识 | `submodule.kind` | 直接存语义类型 | `era` / `event` |
| 时代主题 | `submodule.meta.theme` | 用户自定义主题 id | `theme_id` |
| 时间范围 | `submodule.meta.time` | `{start, end, display}` | `{start: 元年, end: 1633年}` |
| 事件类型 | `submodule.meta.eventType` | 用户自定义类型 id | `custom_type_id` |
| 事件级别 | `submodule.meta.level` | LevelDef.id | `level_id` |
| 事件图标 | `submodule.icon` | Lucide 图标名 | `swords` |
| 模块配置 | `WorldModule.config.history` | HistoryModuleConfig JSON | 见第 8 节 |
| 人物与跨模块关联 | `world_links` | WorldLink 记录 | `history.involves` |

### 2.3 数据转换流程 (后端 → 前端)

```
API 返回: WorldSubmodule[] (getSubmodules) + WorldModuleItem[] (getItems include_all=true)
                    ↓ HistoryView.tsx L106-L148
              数据映射/转换
                    ↓
前端模型: Era[] + Event[] (各含嵌套 EventItem[])

转换规则:
1. Era 判定: isEra(sub) → sub.kind === era 且 !sub.parent_id
   - theme = sub.meta.theme
   - 时间 = sub.meta.time

2. Event 判定: sub.kind === event
   - level = sub.meta.level
   - eventType = sub.meta.eventType
   - 日期 = sub.meta.time
   - eraId = sub.parent_id

3. 独立事件孤儿处理：events.filter(e => !e.eraId) → 归入 时间之外 伪时代

4. 排序: eras 按 compareTimes(startDate), events 按 compareTimes(eventDate)
```

---

## 3. API 调用

### 3.1 历史界面涉及的 API 调用汇总

所有 API 通过 `worldbuildingApi` (基于 Axios) 调用，由 React Query (`@tanstack/react-query`) 管理缓存。

#### 查询 (Queries)

| QueryKey | API 方法 | 触发时机 | 用途 |
|----------|---------|---------|------|
| `['worldbuilding', 'submodules', moduleId]` | `getSubmodules(moduleId)` | 组件挂载 | 获取所有时代+事件子模块 |
| `['worldbuilding', 'items', moduleId]` | `getItems(moduleId, { include_all: true })` | 组件挂载 | 获取所有条目；模块配置从 WorldModule.config 读取 |
| `['characters-simple', projectId]` | `characterApi.getCharactersSimple(projectId)` | EventCard 挂载 | 获取简化人物列表（用于 badge 解析） |
| `['characters', projectId]` | `characterApi.getCharacters(projectId)` | CharacterReference 挂载 | 获取完整人物列表（用于选择器） |

#### 变更 (Mutations)

| Mutation | API 方法 | 触发操作 | 成功后失效 Key |
|----------|---------|---------|---------------|
| `createEraMutation` | `createSubmodule(moduleId, {...})` | 添加时代 | `submodules` |
| `updateEraMutation` | `updateSubmodule(eraId, {...})` | 编辑时代 | `submodules` |
| `createEventMutation` | `createSubmodule(moduleId, {...})` | 添加事件 | `submodules` |
| `updateEventMutation` | `updateSubmodule(eventId, {...})` | 编辑事件 | `submodules` |
| `deleteEventMutation` | `deleteSubmodule(eventId)` | 删除事件 | `submodules`, `items` |
| `updateDescriptionMutation` | `updateSubmodule(id, {description})` | 内联编辑描述 | `submodules` |
| `createItemMutation` | `createItem(moduleId, {...})` | 添加条目 | `items` |
| createLinkMutation | createLink(worldId, {...}) | 添加人物或跨模块关联 | world_links |
| deleteLinkMutation | deleteLink(linkId) | 移除人物或跨模块关联 | world_links |
| `deleteItemMutation` | `deleteItem(itemId)` | 删除条目 | `items` |
| `updateItemMutation` | `updateItem(itemId, {...})` | 编辑条目 | `items` |
| saveModuleConfigMutation | updateModule(moduleId, { config }) | 保存样式配置 | module.config |

### 3.2 关键 API 请求详情

#### 获取子模块 (时代 + 事件)
```
GET /api/v1/worldbuilding/modules/{moduleId}/submodules
→ WorldSubmoduleResponse[]
  { id, module_id, name, description, order_index, color, icon, parent_id, ... }
```

#### 获取条目 (含配置)
```
GET /api/v1/worldbuilding/modules/{moduleId}/items?include_all=true
→ WorldModuleItemResponse[]
  { id, module_id, submodule_id, name, content, order_index, ... }
```

#### 创建子模块（以创建事件为例）
```
POST /api/v1/worldbuilding/modules/{moduleId}/submodules
Body: {
  name: 王朝建立,
  description: 第一位皇帝登基,
  kind: event,
  meta: {
    eventType: custom_type_id,   // 占位示例，实际使用用户定义的类型 id
    level: custom_level_id,      // 占位示例，实际使用用户定义的级别 id
    time: { start: 公元前221年, display: 公元前221年 }
  },
  parent_id: {eraId}
}
```

#### 创建关联（以人物引用为例）
```
POST /api/v1/worldbuilding/worlds/{worldId}/links
Body: {
  source: { module: history, kind: event, id: eventId },
  target: { module: character, kind: character, id: charId },
  link_type: history.involves,
  meta: { role: 亲历者 }
}
```
### 3.3 缓存策略

- **QueryClient** 使用 `invalidateQueries` 在 mutation 成功后使相关查询失效
- `submodules` 和 `items` 分开缓存，避免不必要的请求
- 搜索在前端内存中过滤（不发起额外请求）
- 模块配置从 WorldModule.config 读取，不再作为特殊 item

---

## 4. UI 组件层级

### 4.1 整体组件层级

```
HistoryView (根容器)
├── Toolbar (顶部工具栏)
│   ├── [添加时代] 按钮
│   ├── [搜索框] (搜索时代/事件/条目)
│   ├── [添加事件] 按钮
│   └── [样式配置] 按钮 (Settings)
│
├── EmptyState (空状态 - 无数据时)
│   └── 引导创建第一个时代/事件
│
├── SearchEmptyState (搜索无结果)
│
└── EraSwitchContainer (时代切换容器 - 核心布局)
    │
    ├── EraTabs (时代标签栏)
    │   └── 时代 Tab 列表 (带 layoutId 动画指示器)
    │
    └── 卡片堆叠区域 (perspective 3D 布局)
        ├── AnimatedCard (左侧预览卡片, isLeft=true)
        ├── AnimatedCard (当前活跃卡片, isActive=true) ← 可拖拽滑动
        ├── AnimatedCard (右侧预览卡片, isLeft=false)
        └── AnimatedCard (退出动画卡片, isExiting=true)
            └── EraContentPanel (时代内容面板)
                ├── Header (时代标题栏)
                │   ├── 时代圆点 + 名称 + 时间范围
                │   ├── [编辑] / [删除] 按钮
                │   └── [添加事件] 按钮
                │
                ├── Description (时代描述区 - 可内联编辑)
                │
                └── Content Body
                    ├── EraTimeline (左侧时间轴)
                    │   └── 事件节点圆点 (按 level 区分大小/颜色)
                    │   └── TimelineTooltip (悬浮提示 Portal)
                    │
                    └── EventCards Grid (事件卡片网格)
                        └── EventCard × N
                            ├── Header (事件标题 + 类型标签 + 级别标签)
                            ├── Date (事件日期)
                            ├── Description (描述 - 可内联编辑)
                            ├── Items (条目列表 - 含人物关联标签)
│   └── ItemTag × N (含关联计数徽章)
                            ├── [展开全部] 按钮
                            └── CharacterReference (人物关联区域)
                                ├── 参与人物列表 (CharacterBarCard)
                                └── [添加] 按钮 → CharacterPickerModal
```

### 4.2 模态框 (Modals)

| 模态框 | 触发入口 | 功能 |
|--------|---------|------|
| `AddEraModal` | Toolbar [添加时代] | 创建新时代（名称、描述、起止时间、主题色） |
| `EditEraModal` | EraContentPanel Header [编辑] | 编辑时代信息 |
| `AddEventModal` | Toolbar [添加事件] / EraContentPanel [添加事件] | 创建新事件（名称、描述、级别、日期、图标、所属时代、事件类型） |
| `EditEventModal` | EventCard [编辑] | 编辑事件信息 |
| `AddItemModal` | EventCard [添加条目] | 创建事件下的条目（名称 + 自定义字段内容） |
| `EditItemModal` | EventCard 条目 [编辑] | 编辑条目内容 |
| `ConfigModal` | Toolbar [Settings] | 配置模块样式（时代主题、事件类型、级别样式） |
| `CharacterPickerModal` | CharacterReference [添加] / EventCard 条目 [关联人物] | 选择或快速创建人物并关联到事件 |

### 4.3 三种显示状态

1. **Loading 状态** (`isFirstLoad && isLoading`): 显示 `HistorySkeleton` 骨架屏
2. **空状态** (`eras.length === 0 && orphanEvents.length === 0`): 显示引导创建的 EmptyState
3. **搜索无结果**: 显示 SearchEmptyState
4. **正常状态**: 显示 `EraSwitchContainer` + `EraContentPanel`

---

## 5. 动画系统

### 5.1 动画配置常量 (`config.ts` → `animationConfig`)

```typescript
animationConfig = {
  spring:        { type: 'spring', stiffness: 280, damping: 28, mass: 0.85 },     // 默认弹性
  springSnappy: { type: 'spring', stiffness: 380, damping: 26, mass: 0.8 },      // 快速弹性
  springGentle: { type: 'spring', stiffness: 220, damping: 32, mass: 1 },        // 温和弹性
  ease:         { duration: 0.3, ease: [0.4, 0, 0.2, 1] },                       // 标准缓动
  easeOut:      { duration: 0.28, ease: [0.33, 1, 0.68, 1] },                    // 减出缓动
  stagger:      { staggerChildren: 0.055, delayChildren: 0.12 },                  // 交错动画
}
```

### 5.2 组件变体 (Variants)

#### cardVariants (EventCard 入场/退场)
```
hidden: { opacity: 0, y: 20, scale: 0.97, filter: 'blur(4px)' }
visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }  // spring: stiffness=260, damping=28
exit:    { opacity: 0, scale: 0.96, y: -12, filter: 'blur(3px)' } // duration=0.25
```

#### eraVariants (EraContentPanel 入场/退场)
```
hidden: { opacity: 0, y: 24, scale: 0.97, filter: 'blur(4px)' }
visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
exit:    { opacity: 0, y: -16, scale: 0.96, filter: 'blur(3px)' }
```

#### contentVariants (折叠/展开)
```
collapsed: { height: 0, opacity: 0 }
expanded:  { height: 'auto', opacity: 1 }
```

### 5.3 核心 3D 卡片切换动画 (EraSwitchContainer → AnimatedCard)

这是历史界面最核心的动画系统，采用 **perspective 3D 卡片轮播**：

```
卡片状态机:
┌─────────────────────────────────────────────────────┐
│                                                     │
│  [Side-Left] ←→ [Active] ←→ [Side-Right]          │
│       ↑              ↓              ↑              │
│       └────────── [Exiting] ←────────┘              │
│                                                     │
└─────────────────────────────────────────────────────┘

各状态视觉参数:
┌──────────────┬──────────┬────────┬─────────┬──────────┬──────────┐
│     State    │    x     │ scale │ opacity │   zIndex │  filter  │
├──────────────┼──────────┼────────┼─────────┼──────────┼──────────┤
│ Active       │   0%     │  1.00  │   1.0   │    20    │ blur(0) │
│ Side-Left    │  -28%    │  0.88  │   0.7   │     5    │blur(1.5px)│
│ Side-Right   │  +28%    │  0.88  │   0.7   │     5    │blur(1.5px)│
│ Exiting(→R)  │  -55%    │  0.65  │   0.0   │    25    │blur(10px)│
│ Exiting(→L)  │  +55%    │  0.65  │   0.0   │    25    │blur(10px)│
│ Entering(←R) │  +45%    │  0.75  │  0.85   │    15    │ blur(8px)│
│ Entering(→L) │  -45%    │  0.75  │  0.85   │    15    │ blur(8px)│
└──────────────┴──────────┴────────┴─────────┴──────────┴──────────┘

额外变换:
- Side 卡片: rotateY(±3°), perspective=1200
- Exiting 卡片: rotateY(±20°), brightness(0.75)
- Entering 卡片: rotateY(±15°), brightness(0.8)
```

**切换触发方式：**
- 点击 EraTabs 标签
- 点击侧边预览卡片
- 左右拖拽活跃卡片 (drag elastic=0.12, threshold=60px 或 velocity>500)
- 键盘 ← / → 方向键

**切换流程：**
1. 用户触发切换 → `handleSwitch(targetId)` 
2. 计算 direction (1=向右/-1=向左)
3. 设置 `exitingCard` = 当前活跃卡片 + direction
4. 同步调用 `onSwitchEra(targetId)` 更新 activeEraId
5. AnimatePresence 检测 key 变化：
   - 旧 active 卡片 → 以 exit 动画移出
   - 新 active 卡片 → 从对侧以 enter 动画入场
6. 600ms 后清除 exitingCard 状态，解除锁定

### 5.4 EraTabs layoutId 动画

使用 Framer Motion 的 `layoutId="era-tab-indicator"` 实现标签指示器平滑滑动过渡。

### 5.5 EventCard 微交互

| 交互 | 动画效果 |
|------|---------|
| 整体 hover | y: -4, scale: 1.005, shadow 增强 |
| 最高档级别 | 径向渐变光晕 + 脉冲呼吸圆点动画 (2s/2.5s infinite) |
| 中档级别 | 单个径向渐变光晕 |
| 类型图标入场 | scale: 0.8→1, rotate: -10°→0° (delay 0.1s) |
| 条目 stagger | 每个条目延迟 idx*0.04s 弹性入场 |
| 展开按钮箭头 | rotate: 0↔180° |

### 5.6 EraTimeline 时间轴动画

- 事件节点: `opacity: 0→1, scale: 0→1`, 延迟 index*0.05s
- 最高档节点:
(最高档除外)
- Tooltip: Portal 渲染, `opacity+scale+x` 组合动画

---

## 6. 人物关联（WorldLink 统一关联）

历史界面保留原有的 CharacterPicker 交互：事件卡片上的添加人物按钮打开选择器，
支持选择已有全局 Character 或快速创建。人物数据只存在于应用级 Character，
历史侧不再复制人物字段。

### 6.1 存储与数据流

- 人物关联统一落 WorldLink：source = { module: history, kind: event, id: eventId }，
  target = { module: character, kind: character, id: charId }，link_type = history.involves。
- 事件卡片底部的人物条按出链分组渲染；人物详情的入链显示被涉及。
- 条目级的人物提及使用行内引用 token，不再写入 item.content 的私有前缀键：
  [[character:character:{charId}|显示名]]。
- 旧数据中的 _char_ref_ 与 _char_link 键在迁移时转换为 WorldLink，并保留显示顺序。

### 6.2 交互

- 添加：CharacterPickerModal → 选择人物 → 确认关联类型（默认 history.involves）→ 保存；支持多选批量添加。
- 移除：在人物条或关联面板中移除，删除对应 WorldLink 记录。
- 快速创建：走 characterApi.createCharacter；创建成功后自动建立关联。
- 人物卡片 hover 预览摘要；点击跳转到角色详情，返回栈保留历史界面上下文。

### 6.3 与通用关联的关系

人物只是 WorldLink 的一种目标；事件与时代指向政治、经济、种族、体系、地图的关联
使用同一套 LinkPanel、实体选择器与失效处理，详见第 14 节。
## 7. 中文时间解析系统 (`timeParser.ts`)

历史界面支持**中国古典纪年格式**的时间表达（如"贞观元年"、"建安十三年"、"洪武三十一年"），这是该界面独有的核心工具模块。

### 7.1 支持的时间格式

| 格式 | 示例 | 解析结果 |
|------|------|---------|
| **年号+元年** | `贞观元年`、`开元元` | eraName="贞观", year=1, isYuanNian=true |
| **年号+数字年** | `贞观10年`、`建安13年` | eraName="贞观/建安", year=10/13 |
| **年号+中文数字年** | `洪武二十三年` | eraName="洪武", year=23 |
| **纯阿拉伯数字** | `2024年`、`公元前221年` | eraName="", year=2024/221 |
| **纯中文数字** | `二百零一年` | eraName="", year=201 |
| **空/无效** | `""`、`未知` | sortValue=0, 排到最后 |

### 7.2 核心算法

#### 中文数字 → 阿拉伯数字 转换 (`chineseNumberToArabic`)
```
支持字符: 零〇一二三四五六七八九十百千万
处理逻辑: 按位解析，遇单位词(十/百/千/万)时累乘
特殊: "元" → 1 (用于"元年"简写)
```

#### sortValue 生成规则
```
sortValue = eraHash(eraName) * 100000 + year
其中 eraHash = Σ(charCodeAt(char) * 10^(index % 5))
```

### 7.3 使用位置

```
HistoryView.tsx
  ├── L6: import { compareTimes } from '@/utils/timeParser'
  ├── L122: eras.sort((a, b) => compareTimes(a.startDate, b.startDate))  // 时代排序
  └── L148: events.sort((a, b) => compareTimes(...))                      // 事件排序
```

---

## 8. 样式配置系统 (ConfigModal)

用户可通过工具栏的样式配置按钮（Lucide `settings-2`）打开 `ConfigModal`，自定义三大样式维度。

### 8.1 配置结构

```typescript
interface HistoryModuleConfig {
  eraThemes:   (EraThemeConfig & { id: string })[]   // 时代主题配色方案
  eventTypes:  (EventTypeConfig & { id: string })[]   // 事件类型定义
  levels:      (EventLevelConfig & { id: string })[]   // 事件级别样式
}
```

### 8.2 配置存储与加载

```
存储: WorldModule.config → HistoryModuleConfig JSON

加载: module.config.history → validateHistoryModuleConfig() 校验
      → 失败则使用空配置与通用展示，不预置世界观内容
```

### 8.3 默认配置

| 类别 | 默认值 |
|------|--------|
| **时代主题** | 由用户自定义的色板与纹理集合；示例色名不代表世界观预设 |
| **事件类型** | 由用户自定义，名称、颜色、Lucide 图标均由配置决定 |
| **事件级别** | 由用户自定义，默认仅给宽度档位建议（通栏/半栏/三分栏/四分栏），级别名称自定 |

---

## 9. 搜索系统

### 9.1 搜索范围

覆盖 **三层深度** 数据：

```
匹配目标:
1. 时代 (Era): name, description
2. 事件 (Event): name, description  
3. 条目内容 (EventItem.content): 任意 value 深度匹配
```

### 9.2 搜索联动逻辑

```
1. filteredEras = eras.filter(名称或描述匹配)

2. filteredEvents = events.filter(
     名称匹配 || 描述匹配 || 任一条目内容匹配
   )

3. finalFilteredEras = 联合过滤:
   - 直接匹配的时代
   - 其事件有匹配的时代 (通过 eraId 关联)
   - 独立事件匹配时包含 standalone 时代
```

---

## 10. 内联编辑 (Inline Editing)

时代描述和事件描述均支持**点击即编辑**，无需打开模态框。

### 10.1 时代描述内联编辑

```
点击 → 显示 textarea (autoFocus) → [保存]/[取消]
特殊: standalone 时代不可编辑
```

### 10.2 事件描述内联编辑

```
同上，不同点:
- 高档/中档级别: 暖色系背景
- 普通档级别: 冷色系背景
```

---

## 11. 独立时代 (Standalone Era)

当事件的 `eraId` 为空时，系统自动创建 **"时间之外"** 虚拟时代收纳孤儿事件。

```typescript
const STANDALONE_ERA_ID = '__standalone__';
const standaloneEra = orphanEvents.length > 0 ? {
  id: STANDALONE_ERA_ID,
  name: '时间之外',
  description: '游离于时间之外的独立事件...',
  order_index: Infinity,  // 始终排最后
theme: 'standalone',  // 系统保留主题 id，仅用于独立时代虚拟容器
} : null;
```

### 特殊行为

| 方面 | 行为 |
|------|------|
| 排序 | `order_index: Infinity`，始终末尾 |
| 主题 | 固定 slate/gray 冷色调 |
| 可编辑 | 否（无编辑/删除按钮） |
| 时间轴 | 不显示 |

---

## 12. 跨模块导航（通用）

历史界面通过统一回调 onNavigateToEntity(ref) 跳转到任意模块；角色跳转只是其中一种。
跳转时写入返回栈，头部显示面包屑，返回时恢复滚动位置与展开状态。
行内引用、LinkPanel、事件卡片关联入口共用同一导航入口。
## 13. 性能优化策略

### 13.1 后端: selectinload 批量加载

```python
# 3次查询替代 N+1 问题
# 1. modules + submodules
# 2. module_items (submodule_id IS NULL)
# 3. submodule_items
```

### 13.2 前端: React Query 缓存分层

| 策略 | 实现 |
|------|------|
| 查询分离 | `submodules` 和 `items` 用不同 queryKey |
| 精确失效 | mutation 后只 invalidate 相关 key |
| 条件启用 | `enabled: !!projectId` |
| 内存搜索 | 前端 filter() 不过后端 |

### 13.3 前端: useMemo 计算优化

| 计算 | 依赖 |
|------|------|
| `historyConfig` | `module.config.history` |
| `module.config` | `WorldModule` |
| `baseEras` / `events` | `submodules` / `items` |
| `filteredEras` / `filteredEvents` | `eras` / `events` / `searchQuery` |

### 13.4 渲染优化

- **AnimatePresence mode="popLayout"**: 正确处理布局动画
- **forwardRef (EventCard)**: Framer Motion 需要 ref
- **flushSync**: 切换时代时同步更新状态
- **transitionTimer 600ms**: 连续切换防错乱

---

## 14. 跨模块关联设计（WorldLink）

### 14.1 关联模型

- 事件与时代的跨模块关系全部落独立表 world_links，不再写进 item.content，也不再有各模块自建的引用数组。
- 每条关联包含 source、target（EntityRef：module + kind + id）、link_type、可选 label/note/meta/time。
- 时代与事件的层级关系继续由 submodule.parent_id 表达；跨模块语义才使用 WorldLink，避免重复。
- 对称关联只存一条；非对称关联按 reverseLabel 在入链区展示反向文案。

### 14.2 历史关联类型

| id | 标签 | reverseLabel | 源 → 目标 |
|----|------|--------------|-----------|
| history.occurs_at | 发生于 | 发生事件 | history.event / history.era → 地点、政权、市场、聚居地 |
| history.involves | 涉及 | 被涉及 | history.event / history.era → 政权、组织、人物、角色、种族、体系、经济实体 |
| history.causes | 导致 | 由该事件导致 | history.event → 事件、政权、组织、经济实体、体系节点 |
| history.caused_by | 起因于 | 引发了 | history.event → 任意实体 |
| history.milestone_of | 大事记 | 收录大事记 | history.event / history.era → 政权、种族、体系、组织 |

- 历史默认开放以上类型；用户可在 ModuleConfig.linkTypes 中新增历史域自定义关联。
- 事件级因果由 event 承担；时代作为整体背景时用 era 作为源。

### 14.3 事件卡片与详情中的关联

- 事件卡片右上角显示关联计数徽章；卡片底部保留人物条，并增加关联入口。
- 事件与时代详情使用统一 LinkPanel：按目标模块分组，分「出链 / 入链」两组，行内显示类型标签、目标名、kind 徽章、时间范围与备注。
- 入链只读，可跳转到源实体修改；出链可直接移除或编辑备注。
- 关联计数在列表加载时批量获取，避免逐卡请求。

### 14.4 行内引用

- 在时代描述、事件描述与条目内容中输入 at 符号，打开通用实体选择器，插入 token：
  [[模块:kind:id|显示名]]，历史内以 [[history:event:{eventId}|事件名]] 为主。
- token 只存 id；渲染为可点击 chip，hover 预览，点击跳转；目标失效时显示警示样式并提供清理。
- 行内引用不占用关联类型、不计入关联计数、不进入世界脉络，适合叙述性提及。

### 14.5 添加关联流程

- 入口一：事件或时代详情的 LinkPanel 添加关联按钮。
- 入口二：事件卡片底部人物条的人物添加按钮（人物是关联目标之一）。
- 入口三：从画布节点拖出连线（如后续提供历史画布视图时）。
- 流程：选模块 → 搜索或筛选实体 → 选关联类型（按 kind 自动过滤）→ 可选时间、备注、角色等 meta → 保存。
- 支持多选批量创建同类型关联；类型不匹配时只允许 core.references、core.related_to、custom.link。

### 14.6 跨模块跳转

- 统一回调 onNavigateToEntity(ref: EntityRef)；关联行、行内 chip、搜索结果共用。
- 跳转写入返回栈，头部面包屑显示来源链路；返回时恢复历史界面的滚动位置、展开时代与选中事件。
- 目标已删除时显示引用已失效，提供查看来源与清理引用两个操作。

---

## 15. 反向关联：其他模块如何回链历史

| 来源模块 | 典型关联 | 在历史侧的表现 |
|----------|----------|----------------|
| 政治 | 政权沿革、组织大事记、人物登场；history.milestone_of / history.involves | 事件或时代详情出现政治实体入链；政权详情沿革时间轴读取相关历史事件 |
| 经济 | 经济周期与危机；economy.era_context 对齐时代，history.involves / causes 表示冲击 | 时代卡片显示周期带；事件可挂经济实体 |
| 种族 | 种族迁徙、起源、重大变故；races.inhabits / origin_at + history.involves | 事件详情显示涉及种族；种族详情的历史渊源回链事件 |
| 体系 | 体系突破、传承、失传；systems.advances_to + history.milestone_of | 事件可挂体系或阶位节点；体系阶梯显示突破事件标记 |
| 角色 | 登场、参与、生卒；character.appears_in / history.involves | 事件人物条与角色详情双向可查 |
| 地图 | 事件发生于某地；history.occurs_at | 地图接入后事件落点高亮；未接入时隐藏入口 |
| 特殊 | 通用引用；core.references / core.related_to | 特殊条目可引用事件与时代 |

- 历史模块是其他模块的时间背景：实体的 time 与历史时代对齐，事件作为背景标记回链。
- 反向关联不重复落库：由 WorldLink 的反向查询生成，入链只读。

---

## 16. 自定义与复杂度

### 16.1 可自定义内容

- 时代主题：名称、色板、描述、纹理；默认提供一组基础色板，可增删改。
- 事件类型：名称、Lucide 图标名、颜色、默认级别；类型完全由用户定义。
- 事件级别：名称、宽度档位建议、颜色与字号；默认四档只是建议值，可改名可删。
- 时间显示：历法名称、元年标签、格式；描述中的自然语言时间按现有解析规则处理。
- 术语：时代、事件、时间之外等称谓均可替换。
- 配置存 WorldModule.config，随世界备份导出；系统不提供任何世界观预设内容。

### 16.2 复杂度分层

| 复杂度 | 历史界面呈现 |
|--------|--------------|
| sketch 速写 | 只显示时代列表与事件标题；3 个字段（时代名、事件名、时间）即可用；隐藏关联面板、时间轴动画细节与配置项 |
| structure 结构 | 完整书卷时间轴、事件卡片级别、人物条、统一 LinkPanel、事件类型与级别配置 |
| sandbox 沙盘 | 在结构基础上启用关联计数、跨模块背景带、世界脉络入口、时间范围与统计 |

- 复杂度只改变披露程度，不删除数据；降档时提示已折叠的关联与字段数量。

---

## 17. 空状态与三分钟最小路径

### 17.1 空状态

- 没有时代：显示书卷展开的占位线稿，主按钮为创建第一个时代，副按钮为导入世界备份。
- 有时代但没有事件：时代卡片内显示添加第一个事件与为其添加关联。
- 搜索无结果：显示清除筛选与新建同名事件两个操作。

### 17.2 三分钟路径

1. 创建时代：填写名称、起始时间，选择基调（可跳过）。
2. 在时代下添加事件：填写事件名称与时间，选择级别（可跳过）。
3. 为事件添加一个关联：选择政治、经济、种族、体系、角色或地图中的任意已有实体；
   若目标模块为空，可先跳过，历史界面不会因此阻塞。
4. 完成后事件卡片出现关联计数，侧栏可从任意模块反向找到这个事件。

---

## 18. 本轮不做的事

- 不重做历史界面的视觉风格：书卷式展开、时间轴与事件卡片动画保持现有满意形态。
- 不实现历史画布视图与力导向图编辑；世界脉络由全局提供只读入口。
- 不做自动生成事件、AI 续写时间线、预置历史年表。
- 不做事件的版本历史、协同编辑与审批流。
- 地图与特殊界面保持现状；只保留可选关联目标接入位。

---

本文与 cross_module_link_design.md 配套阅读；数据模型与关联类型以契约为准，
历史界面的视觉与交互以本文为准。

> 修订说明：v2.0 将人物引用与跨模块引用统一为 WorldLink，清理预置模板与 emoji，
> 并补充反向关联、复杂度分层、空状态与最小路径。原有书卷式 UI、动画、时间解析、
> 内联编辑、独立时代与性能策略保持不变。
