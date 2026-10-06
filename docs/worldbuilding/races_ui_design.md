# 种族界面设计（Race Atlas）

> 模块：races / 世界观设定。契约依据：`docs/worldbuilding/cross_module_link_design.md`（WorldLink Contract），术语、数据模型、关联类型均以契约为准。
> 范围：只做界面与交互设计，不写代码、不改其他文档。

---

## 1. 模块定位与在 WorldLink 中的角色

种族模块是一本**种族图鉴**：族裔与支系被整理成可翻阅的卡片，每张卡是一页图鉴，展开后是族裔档案。它只回答"有哪些族裔、住在哪、彼此什么关系、谁代表它们"，不承担数值与规则。

在 WorldLink 中它同时是引用方与被引用方：

- 出链：`races.inhabits` / `races.origin_at`（地图）、`races.related_to`（种族之间）、`races.notable_figure`（全局 Character）、`races.affinity_with`（体系）、特产/物产（见 6.1）。
- 入链：`character.belongs_to_race`、`politics.includes_race`（民族/种族构成）、`history.involves` / `history.milestone_of`（时代或事件）、经济物产的反向引用。
- 跨模块引用只走 WorldLink，禁止在 item 里写 `map:region_001` 式字符串；关联增删改统一在 LinkPanel，双向可查。
- 关联类型、颜色、线型复用契约 4.5 注册表，模块不另建关系结构。

重要程度不平均：`race`（主条目）> `subrace`（支系）> `atlas.*` item（长文/字段组）。主条目用大图鉴卡，支系是卡内一行，长文默认折叠。

---

## 2. 信息架构与实体层级

```
WorldModule(races)
└─ WorldSubmodule(kind='race')              主条目：一页图鉴
   ├─ WorldSubmodule(kind='subrace')        支系：parent_id 指向 race，上限 2 层
   │  └─ WorldModuleItem(name='atlas.*')    支系自己的字段组与长文
   └─ WorldModuleItem(name='atlas.*')       主条目的字段组与长文

WorldLink                                   所有跨模块引用与种族关系统一存这里
```

1. **最多两层**：`race → subrace` 用 `parent_id` 表达从属，不再额外建"包含"关联，避免双重表达。
2. 支系可拥有自己的字段与关联；未填字段在详情页只读继承父级展示，不复制数据。
3. 可新增 `custom_*` kind，但必须声明 `parentKind` 且深度不超过 2；第三层入口置灰并提示。
4. `races.related_to` 只表达**跨族关系**（血缘、渊源、敌对等），不用于父子从属。

---

## 3. 数据模型（kind / meta / items / config 映射）

### 3.1 kind

```typescript
type BuiltinRaceKind = 'race' | 'subrace';
type RaceKind = BuiltinRaceKind | `custom_${string}`;   // 自定义 kind 必须声明 parentKind
```

### 3.2 meta（WorldSubmodule.meta）

```typescript
interface RaceMeta {
  tagline?: string;              // 一句话特征，卡片正面唯一必读文案
  traits?: string[];             // 特征标签，建议最多 6 个
  habitatText?: string;          // 居住地文本回退：地图未接入时展示
  originText?: string;           // 起源地文本回退
  emblem?: {                     // 纹章：代表色 + Lucide 图标（不用 emoji）
    icon?: string;               // 如 book-marked、leaf、moon
    color?: string;              // 调色板 token 或 hex，需给 light/dark 两套值
    motif?: string;              // 母题说明，可空
  };
  status?: string;               // StatusDef.id（如 存续 / 消亡 / 融合，用户定义）
  customFields?: Record<string, CustomFieldValue>;
}
```

### 3.3 items（WorldModuleItem.content）

| item name | 承载内容 | 建议字段 |
|---|---|---|
| `atlas.profile` | 生理档案 | appearance、lifespan、reproduction、diet |
| `atlas.culture` | 文化与社会 | culture、language、custom |
| `atlas.talents` | 天赋文本 | talents、limits |
| `atlas.origins` | 历史渊源长文 | summary、body（具体事件走 history 关联） |

```typescript
interface AtlasItemContent {              // 按 item name 取用其中的字段组
  appearance?: string; lifespan?: string; reproduction?: string; diet?: string;
  culture?: string; language?: string;
  talents?: string; limits?: string;
  summary?: string; body?: string;
  custom?: Record<string, CustomFieldValue>;
}
```

> `atlas.talents` 只写文本；能力、阶位、代价属于 systems，种族通过 `races.affinity_with` 表达亲和，不复制体系数据。

### 3.4 ModuleConfig 映射

```typescript
interface RacesModuleConfig extends ModuleConfig {
  defaultComplexity?: ComplexityLevel;   // 建议默认 'sketch'
  displayMode?: 'atlas' | 'lineage';     // 默认 'atlas'
  cardFields?: Array<'tagline' | 'habitat' | 'traits' | 'linkCount'>;
  relationKinds?: Array<{                // 叠加在 races.related_to 上的语义分色
    id: string;                          // bloodline / origin / hostility / custom_*
    label: string;
    color?: string;
    lineStyle?: 'solid' | 'dashed' | 'double';
  }>;
  emblemPalette?: string[];              // 代表色板，第一项为默认色
}
```

### 3.5 存储映射

| 设计概念 | 落库位置 | 说明 |
|---|---|---|
| 主条目 / 支系 | `WorldSubmodule(kind, parent_id)` | 两层树，name 即图鉴标题 |
| 基础字段 | `WorldSubmodule.meta` | tagline、traits、emblem、habitatText、customFields |
| 长文与字段组 | `WorldModuleItem(name='atlas.*')` | content 为 JSON，不存跨模块引用 |
| 模块设置 | `WorldModule.config` | RacesModuleConfig |
| 跨模块引用 | `WorldLink` | 唯一来源，显示名按 id 实时解析 |
| 术语替换 | `WorldSettings.terminology` + 模块 config | 模块级覆盖世界级 |

---

## 4. UI 设计

### 4.1 主视图：图鉴网格

```
种族图鉴   [search 搜索]   [layout-grid 图鉴|network 血缘]
[sliders-horizontal 复杂度]                    [+ 新建种族]
────────────────────────────────────────────────────────
分类 [全部] [主条目] [支系]      排序 [名称] [最近编辑]
┌────────────────────┐ ┌────────────────────┐
│ book-marked        │ │ leaf               │
│ 主条目甲           │ │ 主条目乙           │
│ 一句话特征…        │ │ 一句话特征…        │
│ [标签] [标签]      │ │ [标签]             │
│ map-pin 居住地     │ │ map-pin 居住地     │
│ 支系 2  关联 6     │ │ 支系 0  关联 3     │
└────────────────────┘ └────────────────────┘
```

- 卡片即图鉴页：顶部竖条为纹章色，主图标取 `RaceMeta.emblem.icon`，右上角是统一关联计数徽章。
- 居住地优先读排序最前的 `races.inhabits`，无关联时回退 `meta.habitatText`；两者皆无显示"未记录"。
- 主条目两行文案 + 标签 + 页脚；支系在详情内以紧凑行展示，不单独占大卡。
- 列数：不小于 1440px 四列，1024-1440px 三列，768-1024px 两列，小于 768px 单列；卡片最小宽 260px。

### 4.2 详情页：图鉴展开页

```
[chevron-left 返回]              [pencil 编辑] [panel-right 关联]
┌────┐ 主条目甲                [book-marked 主条目] [存续]
│纹章│ 一句话特征…                     关联 6 · 出链 4 入链 2
└────┘ [标签] [标签]   居住地: 地点甲 · 地区
───────────────────────────────────┬────────────────────
档案                                 │ 关联 [出链 4] [入链 2]
 外貌 / 寿命 / 繁衍 / 文化 / 天赋    │ 地图 [map-pin] 聚居 地点甲
 历史渊源 ……………………（长文折叠）    │ 体系 [sparkles] 亲和 体系甲
代表人物 (user-round)(user-round) [+ 添加]│ 经济 [wheat] 特产 物产甲
          角色甲      角色乙          │ 角色 [user-round] 代表 角色甲
支系 ┌ 支系甲 · 亚种 ┐ ┌ 支系乙 · 亚种 ┐│        [+ 添加关联]
     └ 关联 2        ┘ └ 关联 1        ┘│
```

- 左栏按"生理 → 文化 → 天赋 → 渊源"排序；空字段显示幽灵占位（点击就地编辑），不显示空白标题。
- 代表人物为头像行，数据来自 `races.notable_figure`；缺图时用角色名首字 + 角色主题色生成字母章。
- 支系区只展示直接子级，第三层入口不出现；右栏为契约统一 LinkPanel（见 6.2），窄屏折叠为抽屉。

### 4.3 血缘树（race / subrace 关系视图）

```
血缘树   [filter 关系: 血缘|渊源|敌对|全部]  [maximize 适配] [list 列表]
      ┌──────────────┐
      │ 主条目甲     │ race
      └──────┬───────┘
             │ parent_id 实线（层级）
     ┌───────┴────────┐
┌──────────────┐  ┌──────────────┐
│ 支系甲       │  │ 支系乙       │ subrace
└──────┬───────┘  └──────┬───────┘
       └───────┬─┐  ┌────┘
               ▼ ▼  ▼
   ┌──────────────┐  - - -  ┌──────────────┐
   │ 主条目乙     │         │ 主条目丙     │
   └──────────────┘         └──────────────┘
图例: 实线=父子层级；双线=血缘/渊源；虚线=敌对/其他 relationKind
```

- 主条目为一级节点，支系挂其下；跨族 `races.related_to` 以曲线连接，按 `meta.relationKind` 分色线型。
- 对称关联只存一条，树上双向可见；点击边可改 relationKind、备注与起止时间。
- 节点不超过 80 用树状布局，超过 80 自动降级为"按主条目分组的列表 + 关系列"；sketch 档不显示此视图。

### 4.4 视觉规范

| 项 | 规格 |
|---|---|
| 领域强调色 | teal；色板 light/dark：`#0f766e / #5eead4`、`#0d9488 / #99f6e4`、`#115e59 / #2dd4bf` |
| 纹章 | 色块 + Lucide 图标，不用 emoji；色块 40 / 32 / 24 三档 |
| 字体 | 图鉴标题 20/600，一句话特征 14/400，标签 12/500，正文 14/400 |
| 卡片与动效 | 圆角 12，1px 边框，hover 抬升 1px，150-300ms；`prefers-reduced-motion` 时取消位移 |
| 状态与图标 | 状态用文字徽章 + CSS 圆点；Lucide 名：book-open、book-marked、dna、git-merge、map-pin、sprout、user-round、users、sparkles、wheat、shopping-basket、layout-grid、network、filter、plus、pencil |

---

## 5. 交互设计

### 5.1 创建与编辑

1. `[+ 新建种族]` 打开速写表单：**名称（必填）+ 一句话特征 + 代表色/图标**，其余折叠在"更多字段"。
2. 保存后卡片淡入网格，详情以速写档位自动打开，光标落在"一句话特征"；字段就地编辑、失焦保存。
3. `Escape` 撤销本次输入，`Cmd/Ctrl + Enter` 保存长文；删除确认框列出将被级联删除的关联清单（契约 2.5）。
4. 支系行 `[+ 添加支系]` 创建子级并自动写入 `parent_id`；第三层入口不渲染。

### 5.2 关联

- 关联的查看、添加、编辑、删除都在统一 LinkPanel 内完成，不提供模块私有关系编辑器。
- `[+ 添加关联]` 走契约 5.2 通用选择器：模块 → 实体（kind 过滤、最近使用）→ 类型（按源/目标 kind 自动过滤）→ 可选备注/时间 → 保存。
- sketch 档走简化流程：默认 `core.related_to`，先建边后改标签；structure 起展示完整类型与字段。
- 血缘树连线编辑与 LinkPanel 写同一份 WorldLink：树上查看血缘，面板改元数据，两处实时同步。
- 长文输入 @ 插入 `[[character:character:xxx|角色甲]]` 等 token，渲染为可点击 chip；失效引用显示警示 chip。

### 5.3 血缘树、搜索与跳转
- 拖拽支系换父级（只允许 race 作父级）；从节点边缘拖到另一节点创建 `races.related_to`。
- `图鉴 / 血缘` 切换不丢失选中项；树 / 列表两态可切换，键盘 `/`、`j/k`、`Enter`、`g` 全程可用。
- 搜索覆盖名称、tagline、traits 与自定义字段；筛选支持 kind / status / 标签 / 有无关联 / 有无支系，条件写入 URL query。
- 点击关联行、头像、地图 chip 跳到目标实体；面包屑 `世界观 / 种族 / 主条目甲 / 角色甲`，返回恢复滚动位置与筛选。
- 目标模块未接入时入口隐藏而非禁用；失效引用显示警示 chip，可重新指向或清理。

---

## 6. 与其他模块的关联设计

### 6.1 关联总表

| 关联 id | 方向 | 种族界面位置 | 目标侧反显 | 未接入处理 |
|---|---|---|---|---|
| `races.inhabits` | race/subrace → 地图地区 | 卡片"居住地"、详情头部 | 有该族聚居 | 隐藏；回退 `meta.habitatText` |
| `races.origin_at` | race → 地图地区 | 详情"起源" | 是起源地 | 隐藏；回退 `meta.originText` |
| `races.related_to` | race ↔ race | 血缘树边、详情"族外关系" | 血缘/渊源 | 始终可用；语义放 `meta.relationKind` |
| `races.notable_figure` | race → character | 代表人物头像行 | 代表种族 | 始终可用（全局角色） |
| `races.affinity_with` | race → systems.system | 详情"体系亲和" chip | 亲和种族 | 体系未接入时隐藏 |
| `character.belongs_to_race` | character → race/subrace | 入链"拥有族裔" | 拥有族裔 | 始终可用 |
| `politics.includes_race` | polity → race/subrace | 种族详情入链：构成 | 构成 | 政治未接入时隐藏（只读） |
| `races.specialty` | race/subrace → economy.resource/good | 详情"特产" chip | 特产于 | 经济未接入时隐藏 |
| `races.prefers` | race/subrace → economy.good/market | 详情"消费偏好" chip | 受偏好 | 经济未接入时隐藏 |
| `history.involves` | history.event / era → race | 入链"被涉及" | 被涉及 | 历史未接入时隐藏 |
| `history.milestone_of` | history.event / era → race | 详情"大事记"时间线 | 收录大事记 | 同上 |

### 6.2 统一 LinkPanel（种族详情右栏）

```
关联  [出链 9] [入链 4]                    [+ 添加关联]
┌────────────────────────────────────────────────────┐
│ 地图   [map-pin] 聚居        地点甲 · 地区   -     │
│        [sprout]  起源于      地点乙 · 地区   -     │
│ 体系   [sparkles] 体系亲和   体系甲 · 体系   -     │
│ 角色   [user-round] 代表人物 角色甲 · 角色   -     │
│ 经济   [wheat] 特产          物产甲 · 商品   -     │
│        [shopping-basket] 消费偏好 市场甲     -     │
│ 政治   [users] 构成          政权甲 · 政权   -     │
│ 历史   [users] 被涉及        事件甲 · 事件   某纪 12 年
│        [flag]  收录大事记    时代甲 · 时代   某纪   │
│ 入链   [user-round] 拥有族裔 角色乙 · 角色   -     │
└────────────────────────────────────────────────────┘
```

结构与契约 5.1 一致：按目标模块分组、组内按关联类型排序；行内显示类型标签（反向关系用 reverseLabel）、目标名、kind 徽章、时间与备注摘要；hover 预览、点击跳转、入链不可直接删除。卡片与树节点右上角显示统一关联计数徽章。

### 6.3 各模块落地要点
- **地图**：inhabits / origin_at 指向地区；未接入时隐藏分组，用 habitatText / originText 文本回退；地图侧反显有该族聚居 / 是起源地。
- **历史**：时代与事件都可 involves / milestone_of 种族；大事记混排时代区间与事件，不自动生成内容。
- **经济**：specialty 表特产、prefers 表消费偏好；经济侧反显特产于 / 受偏好；只存 WorldLink，不复制产量与价格。
- **体系**：affinity_with 表亲和；体系侧反显亲和种族，可写 affinityNote；不复制 tier / ability，天赋文本留在 atlas.talents。
- **角色**：notable_figure 是代表人物（角色侧反显代表种族）、belongs_to_race 是客观归属（种族侧反显拥有族裔）；互不自动创建，可一键升级并去重。
- **政治**：politics.includes_race（民族/种族构成，polity → race/subrace）从政治侧指向种族，种族侧入链反显构成，政权侧显示民族/种族构成；不新增私有结构。

### 6.4 双向可查性检查

- 添加聚居/起源后地图侧出现"有该族聚居 / 是起源地"；建立种族关系后对方血缘树出现同一条边（对称关联单条存储）。
- 选代表人物、添加体系亲和、添加特产与偏好后，角色 / 体系 / 经济实体详情出现反向入链；政权设置民族/种族构成后，种族详情出现构成入链。
- 角色设置种族归属、历史时代或事件涉及种族后，种族详情立即可见"拥有族裔 / 被涉及 / 收录大事记"。

---

## 7. 自定义能力

| 能力 | 配置入口 | 说明 |
|---|---|---|
| 种族类别 kind | `ModuleConfig.entityTypes` | 内置 `race` / `subrace` 不可删；可加 `custom_*`，须声明 `parentKind` 且深度不超过 2 |
| 自定义字段 | `ModuleConfig.fieldSchema[kind]` | 外貌、寿命、繁衍、天赋、聚居、习俗等任意字段组，支持 text / textarea / number / select / date / entityRef / image |
| 字段组顺序 | item 的 `order_index` | 调整"生理 / 文化 / 天赋 / 渊源"顺序，可整组隐藏 |
| 纹章与颜色 | `RaceMeta.emblem` + `emblemPalette` | 图标用 Lucide 名，颜色支持 token / hex，并给出 light/dark 两套值 |
| 关系语义 | `RacesModuleConfig.relationKinds` | 在 `races.related_to` 上叠加血缘 / 渊源 / 敌对 + 自定义，只影响标签与线型 |
| 状态 | `ModuleConfig.statuses` | 如 存续 / 消亡 / 融合；状态用 StatusDef，不当作 kind |
| 等级 | `ModuleConfig.levels` | 可选：定义卡片的权重档（用于尺寸与排序），含义由用户决定，不预置 |
| 术语 | `RacesModuleConfig.terminology` | 例：种族 → 族裔、亚种 → 支系、图鉴 → 志；模块级覆盖世界级 |

---

## 8. 复杂度分层

| 维度 | sketch（速写，默认） | structure（结构） | sandbox（沙盘） |
|---|---|---|---|
| 必填 | 名称 + 一句话 + 代表色 | 同左 | 同左 |
| 卡片 | 名称 / 一句话 / 色 / 关联计数 | 加标签、居住地、支系统计、纹章图标 | 加关系强度、时间有效性、物产计数 |
| 详情 | 档案摘要 + 关联计数 | 完整图鉴字段 + 支系 + 头像行 + 完整 LinkPanel | 加关系时间线、分布说明与统计 |
| 关系 | 只显示计数与行内引用；添加关联默认 `core.related_to` | 血缘树 + 完整关联面板 + 通用选择器 | 接入世界脉络的种族子图，启用强度/时间维度 |
| 其他 | 不加载血缘布局，不做数值 | 模块互联在本档全部可用 | 按 kind / status 的分布与关联密度统计 |

降档只隐藏、不删除数据，升档恢复；sketch 下已建的关联仍计入卡片徽章与 LinkPanel 计数。

---

## 9. 空状态与引导

```
┌──────────────────────────────────────┐
│            [book-open 48]            │
│          还没有种族条目              │
│  从"名称 + 一句话 + 代表色"开始。    │
│  [ + 新建种族 ]   [ 查看关联说明 ]   │
└──────────────────────────────────────┘
```

- 模块为空：主按钮开速写表单，次按钮开 6.1 表的帮助抽屉；不展示推荐模板、示例种族或世界观类型选择器。
- 筛选/搜索为空：`[search-x] 没有匹配的种族` + "清空筛选"按钮 + 当前筛选 chip；无筛选则回到模块空状态。
- 局部空：档案字段显示幽灵占位"添加外貌/寿命/繁衍"；支系区"还没有支系 + [+ 添加支系]"；头像行"未关联代表人物 + [+ 从角色中选择]"；血缘树"还没有跨族关系 + [+ 建立关系]"；大事记"暂无历史事件"（历史未接入时隐藏按钮）。
- LinkPanel 为空：显示"暂无关联"与 `[+ 添加关联]`，不显示空分组标题，出链/入链计数均为 0。

---

## 10. 最小可用路径（3 分钟）

| 时间 | 动作 | 结果 |
|---|---|---|
| 0:00-0:10 | 打开 races 模块 | 空状态引导（有数据则直接见图鉴网格） |
| 0:10-0:50 | 新建种族，填名称、一句话、选代表色并保存 | 图鉴卡出现在网格，详情自动打开 |
| 0:50-1:30 | 补 1-2 句外貌 / 寿命（可选） | 卡片与详情达到可读 |
| 1:30-2:20 | 在 LinkPanel 或血缘树加一条关联（地图/角色/体系/经济任一） | 关联计数 +1，目标侧出现反向入链 |
| 2:20-2:50 | 添加一个支系（可选） | 血缘树出现父子两个节点 |
| 2:50-3:00 | 切换图鉴 / 血缘确认 | 最小可用的种族图鉴完成 |

最短路径的三条约束：必填只有 3 个字段；所有关联都能从详情右栏一步直达；任何字段可后补，空状态不阻塞保存。

---

## 11. 性能与实现建议
- 关联计数批量聚合 `world_links`，索引按契约 2.5；WorldLink 只存 EntityRef，名称批量解析。
- 超过 200 张卡启用虚拟滚动或分页；头像按 40 / 64 / 128 懒加载。
- 血缘树不超过 80 节点用树布局，超过即降级列表；布局只在 structure / sandbox 加载。
- 删除按契约 2.5 提示级联与失效引用；搜索防抖 200ms；颜色对比达 WCAG AA，动效可关闭。

---

## 12. 本轮不做的事

1. 不写前后端代码，不建数据表，不迁移旧数据。
2. 不预置任何种族、亚种、分类、示例数据或世界观模板。
3. 不支持第三层及以上的族裔层级，不做多父级血缘。
4. 不做人口 / 基因 / 演化模拟，不做数值、战力与平衡计算。
5. 不做地图界面改造；地图未接入时隐藏地图关联入口，仅保留文本回退。
6. 不做自动派生关联（如支系自动继承父级聚居地），关联一律由用户显式创建。
7. 不做跨世界关联、公开分享与模板市场（延续契约对模板概念的删除）。
8. 不做 AI 自动生成种族文案、配图或纹章。
