# 世界观设定 - 历史界面 (HistoryView) UI 设计实现总结

## 1. 概述与文件结构

### 1.1 项目定位

HistoryView 是 LocalScribe 世界观模块中 **历史模块** 的核心界面，用于管理世界的时间线、时代与事件。核心特性：

- **时代-事件二级结构**：时代（Era）包含多个事件（Event），事件可关联条目（EventItem）和人物
- **中国古典纪年**：支持"贞观元年"、"建安十三年"等中文时间表达
- **3D 卡片轮播**：创新的时代切换交互体验
- **双模式人物关联**：事件级独立引用 + 条目级内联链接

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
│   WorldTemplate, WorldModule, WorldSubmodule, WorldModuleItem, WorldInstance, CustomWorldviewConfig
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
  startDate?: string                     // 起始时间 (从 icon 字段解析 "era:{start}:{end}")
  endDate?: string                       // 结束时间
  order_index: number                    // 排序索引
  theme?: EraTheme                       // 时代主题色
}

interface Event {
  id: string
  name: string                           // 事件名称
  description?: string                   // 事件描述
  level: EventLevel                      // 事件重要级别
  eventDate?: string                     // 事件日期 (从 icon 字段解析 "date:{date}")
  icon?: string                          // 自定义图标
  order_index: number
  eraId?: string                         // 所属时代 ID (parent_id)
  items: EventItem[]                     // 关联条目列表
  eventType?: EventType                  // 事件类型
}

interface EventItem {
  id: string
  name: string                           // 条目名称
  content: Record<string, string>         // 结构化内容 (KV 对)
  order_index: number
}

// ===== 枚举类型 =====

type EventLevel = 'critical' | 'major' | 'normal' | 'minor'
type EraTheme = 'ochre' | 'gilded' | 'verdant' | 'cerulean' | 'patina' | 'parchment' | 'cinnabar' | 'ink' | 'standalone'
type EventType = 'imperial' | 'war' | 'culture' | 'discovery' | 'disaster' | 'folk' | 'mystery' | 'legacy'

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
  icon: string                            // emoji 图标
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
  icon: string                            // 星级符号
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
WorldTemplate (世界模板)
  └── WorldModule (module_type='history')  ← moduleId
        ├── WorldSubmodule (color 以 'era:' 开头, parent_id=NULL)  → 前端 Era
        │     └── WorldSubmodule (color 以 'type:' 开头, parent_id=eraId)  → 前端 Event
        │           └── WorldModuleItem (submodule_id=eventId)  → 前端 EventItem
        └── WorldModuleItem (name='moduleConfig')  → HistoryModuleConfig 序列化存储
              └── content JSON: { eraThemes: [...], eventTypes: [...], levels: [...] }
```

**关键字段编码约定：**

| 用途 | 存储字段 | 编码格式 | 示例 |
|------|---------|---------|------|
| 时代标识 | `submodule.color` | `era:{themeName}` | `"era:ochre"` |
| 时代时间范围 | `submodule.icon` | `era:{startDate}:{endDate}` | `"era:公元元年:公元500年"` |
| 事件标识 | `submodule.color` | `type:{eventType}[:{level}]` | `"type:imperial:critical"` |
| 事件日期 | `submodule.icon` | `date:{eventDate}` | `"date:2024年1月"` |
| 事件自定义图标 | `submodule.icon` | 直接存图标字符串 | `"⚔️"` |
| 人物引用 (独立) | `item.name` | `_char_ref_{charId}` | `"_char_ref_abc123"` |
| 人物引用内容 (独立) | `item.content[key]` | `_char_ref:{charId}` | `"_char_ref:abc123": "张三"` |
| 人物链接 (条目级) | `item.content[key]` | `_char_link:{itemId}:{charId}` | `"_char_link:item001:abc123": "张三"` |
| 模块配置 | `item.name` | `"moduleConfig"` | 固定值 |

### 2.3 数据转换流程 (后端 → 前端)

```
API 返回: WorldSubmodule[] (getSubmodules) + WorldModuleItem[] (getItems include_all=true)
                    ↓ HistoryView.tsx L106-L148
              数据映射/转换
                    ↓
前端模型: Era[] + Event[] (各含嵌套 EventItem[])

转换规则:
1. Era 判定: isEra(sub) → sub.color.startsWith('era:') && !sub.parent_id
   - theme = parseEraTheme(sub.color)     // "era:ochre" → "ochre"
   - 时间 = sub.icon.replace('era:', '').split(':')

2. Event 判定: !isEra(sub)
   - level = parseEventLevel(sub.color)   // "type:imperial:critical" → "critical"
   - eventType = parseEventType(sub.color) // "type:imperial:critical" → "imperial"
   - 日期 = sub.icon.replace('date:', '')
   - eraId = sub.parent_id

3. 独立事件孤儿处理: events.filter(e => !e.eraId) → 归入 "时间之外" 伪时代 (STANDALONE_ERA_ID)

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
| `['worldbuilding', 'items', moduleId]` | `getItems(moduleId, { include_all: true })` | 组件挂载 | 获取所有条目（含 moduleConfig） |
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
| `createItemForEventMutation` | `createItem(moduleId, {...})` | 添加人物引用条目 | `items` |
| `deleteItemMutation` | `deleteItem(itemId)` | 删除条目 | `items` |
| `updateItemMutation` | `updateItem(itemId, {...})` | 编辑条目 / 关联/取消关联人物 | `items` |
| `saveConfigMutation` | `createItem/updateItem(...)` | 保存样式配置 | `items` |

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

#### 创建子模块 (以创建事件为例)
```
POST /api/v1/worldbuilding/modules/{moduleId}/submodules
Body: {
  name: "王朝建立",
  description: "第一位皇帝登基",
  color: "type:imperial:critical",    // 编码: 类型 + 级别
  icon: "date:公元前221年",           // 编码: 日期
  parent_id: "{eraId}"                // 所属时代
}
```

#### 创建条目 (以人物引用为例)
```
POST /api/v1/worldbuilding/modules/{moduleId}/items
Body: {
  name: "_char_ref_{charId}",
  content: { "_char_ref:{charId}": "秦始皇" },
  submodule_id: "{eventId}"
}
```

### 3.3 缓存策略

- **QueryClient** 使用 `invalidateQueries` 在 mutation 成功后使相关查询失效
- `submodules` 和 `items` 分开缓存，避免不必要的请求
- 搜索在前端内存中过滤（不发起额外请求）
- `moduleConfig` 作为特殊 item（`name === 'moduleConfig'`）从 items 中提取，通过 `useMemo` 解析验证

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
                            │   └── ItemTag × N (含 char link badge)
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
| critical 级别 | 径向渐变光晕 + 脉冲呼吸圆点动画 (2s/2.5s infinite) |
| major 级别 | 单个径向渐变光晕 |
| 类型图标入场 | scale: 0.8→1, rotate: -10°→0° (delay 0.1s) |
| 条目 stagger | 每个条目延迟 idx*0.04s 弹性入场 |
| 展开按钮箭头 | rotate: 0↔180° |

### 5.6 EraTimeline 时间轴动画

- 事件节点: `opacity: 0→1, scale: 0→1`, 延迟 index*0.05s
- critical 节点: 双层脉冲扩散动画 (scale: 1→2.2, 1.8s infinite, 交错 0.4s)
- hover 节点: `scale: 1.25` (critical 除外)
- Tooltip: Portal 渲染, `opacity+scale+x` 组合动画

---

## 6. 人物关联

### 6.1 关联架构

历史界面支持 **两种人物关联模式**：

```
┌─────────────────────────────────────────────────────────────┐
│                   人物关联体系                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  模式一: 事件级独立引用 (Standalone Char Ref)                 │
│  ─────────────────────────────────────────                  │
│  存储: WorldModuleItem                                       │
│  name = "_char_ref_{charId}"                                │
│  content = { "_char_ref:{charId}": "charName" }             │
│  submodule_id = eventId                                     │
│                                                             │
│  组件: CharacterReference                                   │
│  位置: EventCard 底部独立区域                                 │
│  功能: 显示参与人物的 CharacterBarCard 列表                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  模式二: 条目级内联链接 (Inline Char Link)                    │
│  ─────────────────────────────────                          │
│  存储: 已有 WorldModuleItem 的 content 字段新增               │
│  content["_char_link:{itemId}:{charId}"] = "charName"       │
│                                                             │
│  位置: EventCard 内每个 ItemTag 上                            │
│  功能: 小型人物 badge (头像+名字+取消按钮)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 数据流

```
用户操作流:

[添加人物]
    │
    ├─→ CharacterPickerModal 打开
    │       ├─ Tab "选择已有": 搜索 → characterApi.getCharacters()
    │       └─ Tab "快速创建": 表单 → characterApi.createCharacter(source='history')
    │
    ├─→ 模式一 (CharacterReference):
    │   onSelect → addCharRefMutation
    │   → worldbuildingApi.createItem({
    │       name: `_char_ref_${charId}`,
    │       content: { `_char_ref:${charId}`: charName },
    │       submodule_id: eventId
    │     })
    │
    └─→ 模式二 (EventCard ItemTag):
        onSelect → handleLinkCharacter
        → updateItemMutation
        → worldbuildingApi.updateItem(itemId, {
            content: { ...existing, `_char_link:${itemId}:${charId}`: charName }
          })

[移除人物]
    │
    ├─→ 模式一: removeCharRefMutation → deleteItem(itemId)
    │   (删除整个 _char_ref_ 条目)
    │
    └─→ 模式二: handleUnlinkCharacter → updateItemMutation
        → 从 content 中删除对应的 _char_link: key
```

### 6.3 人物数据来源

- **API**: `characterApi.getCharacters(projectId)` — 获取完整人物列表
- **API**: `characterApi.getCharactersSimple(projectId)` — 获取简化列表 (用于 picker 和 badge 解析)
- **解析**: 通过 `itemCharLinks` useMemo 从 event.items 中提取所有 `_char_link:` 前缀的 key-value 对

---

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

用户可通过 Toolbar 的 ⚙️ 按钮打开 `ConfigModal`，自定义三大样式维度。

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
存储: WorldModuleItem (name='moduleConfig', submodule_id=NULL)
      → content JSON = { eraThemes: [...], eventTypes: [...], levels: [...] }

加载: items.find(item => item.name === 'moduleConfig')
      → validateHistoryModuleConfig() 校验
      → 失败则回退到 DEFAULT_*_CONFIGS
```

### 8.3 默认配置

| 类别 | 默认值 |
|------|--------|
| **时代主题** | 赭石、鎏金、青绿、釉色、锈迹、宣纸、朱砂、枯墨、独立 (9种) |
| **事件类型** | 帝王👑、征伐⚔️、文华📜、发明💡、灾厄🌋、民俗🏘️、秘闻🔮、传承🏛️ (8种) |
| **事件级别** | ★★★重点大事件(100%宽)、★★大事件(50%)、★普通(33%)、○小事件(25%) (4级) |

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
- critical/major: 暖色系背景
- normal: 冷色系背景
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
  theme: 'standalone',
} : null;
```

### 特殊行为

| 方面 | 行为 |
|------|------|
| 排序 | `order_index: Infinity`，始终末尾 |
| 主题 | 固定 slate/gray 冷色调 |
| 可编辑 | ❌ 否（无编辑/删除按钮） |
| 时间轴 | ❌ 不显示 |

---

## 12. 跨模块导航 (onNavigateToCharacter)

```typescript
interface HistoryViewProps {
  moduleId: string
  projectId: string
  onNavigateToCharacter?: (characterId: string) => void  // 可选回调
}
```

**触发点**: CharacterReference 中 CharacterBarCard 点击 → 回调父组件实现跳转

---

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
| `configItem` | `items` |
| `moduleConfig` | `configItem` |
| `baseEras` / `events` | `submodules` / `items` |
| `filteredEras` / `filteredEvents` | `eras` / `events` / `searchQuery` |

### 13.4 渲染优化

- **AnimatePresence mode="popLayout"**: 正确处理布局动画
- **forwardRef (EventCard)**: Framer Motion 需要 ref
- **flushSync**: 切换时代时同步更新状态
- **transitionTimer 600ms**: 连续切换防错乱
