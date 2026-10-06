# 体系界面设计（进阶阶梯与典籍）

> 模块：systems / 世界观设定。契约依据：`docs/worldbuilding/cross_module_link_design.md`（WorldLink Contract），术语、数据模型、关联类型均以契约为准。
> 范围：只做界面与交互设计，不写代码、不改其他文档。

---

## 1. 模块定位与在 WorldLink 中的角色

体系模块回答"这个世界有哪些可进阶的体系，每一阶需要什么、能做什么、要付出什么"。它**不预设任何具体体系**：修炼、魔法、科技、神系、制度、技艺都只是用户可能创建的内容，系统只提供"有序阶梯 + 可复用节点 + 统一关联"的能力。

在 WorldLink 中它同时是引用方与被引用方：

- 出链：`systems.advances_to` / `requires` / `grants` / `costs`（体系内部）、`systems.practiced_by`（种族/组织/政权）、`systems.enables`（赋能经济产业与商品）、`systems.countered_by`（克制）。
- 入链：`character.practices_system` / `character.attained`、`races.affinity_with`、`history.involves` / `history.milestone_of`（时代或事件）。
- 节点可复用：同一个 ability 可被多条 `systems.grants` 引用，不在各阶位复制。
- 关联类型、颜色、线型复用契约 4.6 注册表；跨模块引用只走 WorldLink。

重要程度不平均：`system`（体系）> `tier`（阶位，路径骨架）> `ability` / `rule` / `cost`（可复用节点）> item（长文）。阶位是阶梯上的大节点，能力是挂在阶位上的小 chip。

---

## 2. 信息架构与实体层级

```
WorldModule(systems)
└─ WorldSubmodule(kind='system')                        体系容器
   ├─ WorldSubmodule(kind='tier',        parent_id=system, meta.rank)
   ├─ WorldSubmodule(kind='ability'|'rule'|'cost', parent_id=system)
   └─ WorldModuleItem(name='codex.*' | 'tier.breakthrough' | 'node.detail')
WorldLink                                               进阶、前置、赋予、代价、赋能、克制、修习
```

1. **归属与复用分离**：所有节点 `parent_id` 指向 system；ability 通过 `systems.grants` 挂到阶位，因此同一能力可被多个阶位或体系引用，不靠 `parent_id` 绑定单一阶位。
2. **排序只看 rank**：tier 按 `meta.rank` 升序（建议 10 / 20 / 30 留插入空间），渲染前归一化；rank 相同则按 `order_index`。
3. **四种内部关联分工**：`advances_to` 是主路径边，`requires` 是额外门槛，`grants` 是"能力挂在阶位上"的方式，`costs` 是代价；不互相替代。
4. **简单模式**：只有"体系名 + 有序等级列表 + 一句话说明"也能保存与阅读；能力、代价、连线都是后续可加的。
5. 可新增 `custom_*` kind，须声明 `parentKind='system'`；子模块树深度不超过 3 层（模块 → system → 节点）。

---

## 3. 数据模型（kind / meta / items / config 映射）

### 3.1 kind

```typescript
type BuiltinSystemKind = 'system' | 'tier' | 'ability' | 'rule' | 'cost';
type SystemKind = BuiltinSystemKind | `custom_${string}`;   // custom 须声明 parentKind
```

### 3.2 meta

```typescript
interface SystemMeta {
  tagline?: string;                 // 一句话说明
  categoryLabel?: string;           // 体系类型展示名，由用户定义
  icon?: string;                    // Lucide 名
  color?: string;                   // 主题色 token 或 hex
  rankDirection?: 'ascending' | 'descending';  // 默认 ascending
  customFields?: Record<string, CustomFieldValue>;
}

interface TierMeta {
  rank: number;                     // 排序唯一依据
  breakthrough?: string;            // 突破条件简述，长文放 item
  branch?: string;                  // 分支名，主线留空
  status?: string;                  // StatusDef.id
  customFields?: Record<string, CustomFieldValue>;
}

interface SystemNodeMeta {           // ability / rule / cost 共用
  nodeType: 'ability' | 'rule' | 'cost';
  summary?: string;                  // 节点摘要
  reusable?: boolean;                // 默认 true
  magnitude?: string;                // 轻量文本描述，不做数值系统
  costHint?: string;                 // 代价节点：资源 / 时间 / 声誉等文本
  customFields?: Record<string, CustomFieldValue>;
}
```

### 3.3 items（WorldModuleItem.content）

| item name | 承载内容 | 建议字段 |
|---|---|---|
| `codex.overview` | 体系总述 | summary、body |
| `codex.principle` | 规则与原理长文 | summary、body |
| `tier.breakthrough` | 某阶突破条件长文 | condition、examples |
| `node.detail` | 能力 / 规则 / 代价长文 | summary、body、examples |

### 3.4 ModuleConfig 映射

```typescript
interface SystemsModuleConfig extends ModuleConfig {
  defaultComplexity?: ComplexityLevel;  // 建议默认 'sketch'
  displayMode?: 'stair' | 'codex';      // 默认 'stair'
  tierTerm?: string;                    // 术语：阶位 / 境界 / 等级
  rankStep?: number;                    // 新建阶位步长，默认 10
  nodeStyles?: Record<string, { icon?: string; color?: string }>; // kind -> 样式
  costFields?: string[];                // 代价节点表单字段顺序
}
```

### 3.5 存储映射

| 设计概念 | 落库位置 | 说明 |
|---|---|---|
| 体系 / 阶位 / 节点 | `WorldSubmodule(kind, parent_id, meta)` | 节点 parent_id 统一指向 system |
| 排序 | `TierMeta.rank` | 只此一处决定阶梯顺序 |
| 长文 | `WorldModuleItem(codex.* / tier.breakthrough / node.detail)` | content 为 JSON |
| 模块设置 | `WorldModule.config` | SystemsModuleConfig |
| 全部关联 | `WorldLink` | 进阶、前置、赋予、代价、赋能、克制、修习 |
| 术语替换 | `WorldSettings.terminology` + 模块 config | 模块级覆盖世界级 |

---

## 4. UI 设计

### 4.1 主视图：三栏阶梯工作台

```
┌─ 体系列表 ──┬─ 进阶阶梯 (体系甲) ──────────┬─ 节点详情 ─────┐
│ 体系甲 6阶  │ ┌──────────────────────┐     │ 阶位乙 · tier  │
│ 体系乙 3阶  │ │ rank 3  阶位丙       │     │ rank 2 · 主线  │
│ 体系丙 4阶  │ │ [gift] 能力甲        │     │ 突破: ……       │
│ [+ 新建体系]│ └─────────▲────────────┘     │ 赋予 2 代价 1  │
│             │           │ advances_to      │ 关联 [出链 5]  │
│ [search 搜索]│ ┌────────┴─────────────┐    │ 进阶 阶位丙    │
│             │ │ rank 2  阶位乙       │     │ 前置 阶位甲    │
│             │ │ [lock] requires 阶位甲│    │ 赋予 能力甲    │
│             │ └─────────▲────────────┘     │ 代价 资源甲    │
│             │           │                  │境界达成者 角色甲│
│             │ ┌─────────┴────────────┐     │                │
│             │ │ rank 1  阶位甲       │     │                │
│             │ └──────────────────────┘     │                │
│             │ [+ 添加阶位]                 │                │
└─────────────┴──────────────────────────────┴────────────────┘
```

- 左栏是体系列表：名称、阶位数量、可选体系色点，支持搜索、筛选与拖拽排序；`[+ 新建体系]` 固定在底部。
- 中栏是阶梯：tier 节点按 `meta.rank` 纵向排列，`advances_to` 实线箭头向上，`requires` 虚线锁，`countered_by` 双线盾牌；同一阶位有多个进阶目标时横向分叉，用 `branch` 分组。
- 右栏是节点详情抽屉：未选中时显示体系概况；结构与 4.2 一致。三栏可折叠，窄屏时右栏变为底部抽屉。
- 阶梯与典籍共用同一选中节点与滚动锚点，切换视图不丢失上下文。

### 4.2 节点详情（右栏 / 抽屉）

```
节点: 阶位乙 (tier)          [pencil 编辑] [trash-2 删除]
rank 2 · 主线 · 存续
突破条件: ……………………………………
赋予: [gift] 能力丙  [gift] 规则甲
前置: [lock] 阶位甲        进阶: [arrow-up-right] 阶位丙
代价: [flame] 代价甲 → 资源甲 · 经济
境界达成者: [chevrons-up] 角色甲 · 角色
关联 [出链 5] [入链 2]      [+ 添加关联]
LinkPanel 按目标模块分组，结构与契约 5.1 一致，完整原型见 6.2。
```

- 详情字段顺序：rank / 分支 / 状态 → 突破条件 → 赋予 → 前置 → 进阶 → 代价 → 境界达成者 → LinkPanel。
- 空字段不显示标题；`ability` / `rule` / `cost` 节点详情显示自身摘要、复用标记与全部挂载它的阶位（来自 `systems.grants` 入链）。
- 点击任一 chip 跳到目标实体；`cost` chip 指向经济资源时带经济字段色，经济未接入则只显示文本。

### 4.3 典籍卡片视图

```
体系甲 · 典籍              [list-ordered 阶梯] [scroll-text 典籍]
┌──────────────────────┐  ┌──────────────────────┐
│ 第一卷 · 阶位甲 r1   │  │ 第二卷 · 阶位乙 r2   │
│ 突破: ……………………      │  │ 突破: ……………………      │
│ 能力: [能力甲] [乙]  │  │ 能力: [能力丙]       │
│ 规则: [规则甲]       │  │ 代价: [代价甲]→资源甲│
│ 关联: 角色 1 · 事件 2│  │ 关联: 角色 2 · 时代 1│
└──────────────────────┘  └──────────────────────┘
┌──────────────────────┐
│ 第三卷 · 阶位丙 r3   │   按 rank 网格 / 横向翻阅
└──────────────────────┘
```

- 一阶一卷，按 rank 排列为卡片网格或横向翻页；卷内顺序为突破条件 → 赋予 → 规则 → 代价 → 关联摘要。
- 典籍视图是可读版本：不做连线编辑，长文在卷内展开；适合阅读、审阅与打印。
- 两个视图共享数据与选中态；切换时保留当前卷的滚动锚点。

### 4.4 视觉规范

| 项 | 规格 |
|---|---|
| 领域强调色 | violet；色板 light/dark：`#6d28d9 / #c4b5fd`、`#7c3aed / #ddd6fe`、`#5b21b6 / #a78bfa` |
| 节点样式 | system=layers、tier=chevrons-up、ability=gift、rule=scroll-text、cost=flame，均用 Lucide 名，可在 `nodeStyles` 覆盖 |
| 阶梯轨 | 左侧 2px 竖向轨道表示 rank，节点圆角 12，当前节点强调色描边；连线按关联类型着色（violet / orange / rose） |
| 字体与动效 | 阶位标题 16/600，节点名 14/500，长文 14/400；展开 150-300ms，`prefers-reduced-motion` 时取消位移 |
| 状态 | 文字徽章 + CSS 圆点，颜色取自 StatusDef；层级 chip 用色阶而非星号拼贴 |

---

## 5. 交互设计

### 5.1 创建体系与阶位

1. `[+ 新建体系]`：填写**体系名 + 一句话说明**（必填），类型 / 图标 / 颜色折叠在"更多"；保存后进入空阶梯并提示添加第一个阶位。
2. 阶位快速录入：多行输入"每行一个阶位"，按行序生成 tier，`rank = 序号 × rankStep`；录入三行即可得到一条有序阶梯，之后可逐个改名、拖拽调序。
3. 在阶位节点 `[+ 添加]` 创建 ability / rule / cost：先建节点（`parent_id = system`），同时自动创建 `systems.grants`（tier → ability）或 `systems.costs`（tier → economy 资源，创建时可选目标）。
4. 拖拽 tier 改 `rank` 即改阶梯顺序；拖 ability chip 到另一阶位 = 新增一条 `grants`，节点本身不移动，体现"节点可复用"。
5. 删除节点时提示它被哪些阶位通过 grants / costs 引用，可选择仅删关联或删节点并级联。

### 5.2 连线与关联

- 从节点端口拖出连线 → 按源/目标 kind 过滤合法类型 → 选择类型并填写可选 meta（备注、时间、量级文本）→ 保存为 WorldLink。
- 所有关联也能在统一 LinkPanel 内以表单方式添加，选择器走契约 5.2：模块 → 实体 → 类型 → meta。
- `advances_to` 与 `requires` 做环路检测：保存前高亮环并阻止，避免阶梯闭环。
- 重复边检测：同一 source/target/type 已存在时提示合并；对称关联（`countered_by`）只存一条。
- 连线编辑与 LinkPanel 写同一份数据，阶梯视图、典籍视图与详情抽屉三处实时一致。

### 5.3 视图、筛选与跳转
- `阶梯 / 典籍` 切换保留选中节点与滚动锚点；复杂度滑杆独立生效，降档只隐藏编辑能力。
- 筛选体系类型、是否含修习者 / 代价 / 历史事件；搜索覆盖体系名、tagline、阶位名、节点名与长文摘要。
- 键盘：`/` 搜索，`j/k` 移动阶位，`Enter` 打开详情，`v` 切换视图，`n` 新建阶位。
- 点击 chip、连线或列表项跳转；面包屑 `世界观 / 体系 / 体系甲 / 阶位乙`，返回恢复来源视图与选中态。
- 目标模块未接入时入口隐藏；失效引用显示警示 chip，可重新指向或清理。

---

## 6. 与其他模块的关联设计

### 6.1 关联总表

| 关联 id | 方向 | 在体系界面的位置 | 目标侧反显 | 未接入处理 |
|---|---|---|---|---|
| `systems.advances_to` | tier → tier | 阶梯主路径实线 | 前身 | 始终可用；环路检测 |
| `systems.requires` | tier/ability → tier/ability | 阶梯虚线锁、节点"前置" | 后续 | 始终可用；环路检测 |
| `systems.grants` | tier/system → ability | 阶位节点内的能力 chip | 由该节点赋予 | 始终可用；支持节点复用 |
| `systems.costs` | ability/tier → economy.resource/good | 节点"代价" chip | 消耗于 | 经济未接入时降级为文本 `costHint` |
| `systems.practiced_by` | system → race/organization/polity | 体系详情"修习/推行" | 修习者 | 目标模块未接入时隐藏 |
| `systems.enables` | system/tier → economy.industry/good | 节点/体系"赋能" chip | 受赋能 | 经济未接入时隐藏 |
| `systems.countered_by` | system/ability ↔ 同左 | 阶梯双线盾牌 | 被克制 | 始终可用；对称单条存储 |
| `character.practices_system` | character → system | 入链"修习者" | 修习者 | 角色全局可用 |
| `character.attained` | character → tier | tier 节点"境界达成者"徽章 | 境界达成者 | 角色全局可用 |
| `races.affinity_with` | race → system | 入链"亲和种族" | 体系亲和 | 种族未接入时隐藏 |
| `history.involves` | history.event / era → 体系节点 | 节点"相关历史" | 被涉及 | 历史未接入时隐藏 |
| `history.milestone_of` | history.event / era → system | 体系"大事记"时间线 | 收录大事记 | 同上 |

补充：时代与事件都可作为 `history.involves` / `history.milestone_of` 的源，用于表达"某时代整体涉及该体系"或"某次突破成为大事记"；事件级因果仍由 history.event 的 `causes` / `caused_by` 承担，体系侧不重复。种族与政权的直连使用 core 类型 politics.includes_race（polity → race/subrace，反显构成），不在体系模块内重复表达。

### 6.2 统一 LinkPanel（节点详情 / 体系详情）

```
关联  [出链 7] [入链 3]                  [+ 添加关联]
┌──────────────────────────────────────────────────┐
│ 体系 [arrow-up-right] 进阶   阶位丙 · 阶位   -   │
│      [lock] 前置            阶位甲 · 阶位   -    │
│      [gift] 赋予            能力丙 · 能力   -    │
│      [shield] 克制          体系乙 · 体系   -    │
│ 经济 [flame] 代价           资源甲 · 资源   -    │
│      [sparkles] 赋能        产业甲 · 产业   -    │
│ 角色 [chevrons-up] 境界达成者 角色甲 · 角色   -    │
│ 其他 [users] 修习/推行      族裔甲 · 主条目 -    │
│ 历史 [flag] 收录大事记      时代甲 · 时代   某纪 │
│ 入链 [sparkles] 亲和种族    族裔乙 · 主条目 -    │
└──────────────────────────────────────────────────┘
```

结构与契约 5.1 一致：按目标模块分组、组内按关联类型排序；行内显示类型标签（反向用 reverseLabel）、目标名、kind 徽章、时间与备注摘要；hover 预览、点击跳转、入链不可直接删除。体系列表项与阶梯节点右上角显示统一关联计数徽章。

### 6.3 各模块落地要点
- **角色**：practices_system / attained 从角色侧创建；体系显示修习者，tier 显示境界达成者数量与头像（structure 起）。
- **种族**：affinity_with 从种族侧指向 system；practiced_by 指向 race 表达整体修习/推行，两者可并存且语义不同。
- **历史**：时代与事件都可 involves 节点或 milestone_of 体系；大事记混排时代区间与事件，sandbox 在阶梯上叠加时间标记。
- **经济**：costs 指向资源/商品，enables 指向产业/商品；经济侧反显"消耗于 / 受赋能"，体系不复制价格与产量。
- **政治**：practiced_by 可指向 organization / polity，政治侧反显修习者；种族与政权的直连为 core 类型 politics.includes_race（polity → race/subrace，反显构成），该直连由种族与政治界面承载。
- **地图**：无专用类型，需要时只用 core.references / core.related_to；未接入时入口隐藏，不阻塞体系使用。

### 6.4 双向可查性检查

- 在阶梯上建 `advances_to` / `requires`：两端节点详情都出现对应边；`grants` 在 ability 详情显示"由该节点赋予"的阶位列表。
- 建 `costs` / `enables`：经济实体详情出现"消耗于 / 受赋能"反向入链。
- 角色修习、种族亲和、政治组织修习、历史时代或事件涉及：体系列表项与节点详情计数即时更新，反向目标侧同步可见。

---

## 7. 自定义能力

| 能力 | 配置入口 | 说明 |
|---|---|---|
| 体系类型 kind | `ModuleConfig.entityTypes` | 内置 `system` / `tier` / `ability` / `rule` / `cost` 不可删；可加 `custom_*`，须声明 `parentKind='system'` |
| 等级定义 | `ModuleConfig.levels` + `TierMeta.rank` | rank 决定阶梯顺序；LevelDef 可定义"初 / 中 / 高"等区间标签与配色，含义由用户决定 |
| 节点字段 | `ModuleConfig.fieldSchema[kind]` | 为 ability / rule / cost 定义字段组；`costFields` 控制代价表单顺序 |
| 颜色与图标 | `SystemMeta` + `SystemsModuleConfig.nodeStyles` | 图标用 Lucide 名，颜色支持 token / hex，给出 light/dark 两套值 |
| 关联类型 | `ModuleConfig.linkTypes` | 可加自定义关联，必须声明方向、标签、源/目标 kind 范围；通用回退仍是 core.references / core.related_to |
| 术语 | `SystemsModuleConfig.terminology` | 例：体系 → 道统、阶位 → 境界、突破 → 晋级；模块级覆盖世界级 |
| 视图与排序 | `displayMode`、`tierTerm`、`rankStep` | 默认阶梯还是典籍、阶位称谓与新建步长均可配置 |
| 状态 | `ModuleConfig.statuses` | 如 可用 / 失传 / 禁忌；状态用 StatusDef，不当作 kind |

---

## 8. 复杂度分层

| 维度 | sketch（速写，默认） | structure（结构） | sandbox（沙盘） |
|---|---|---|---|
| 必填 | 体系名 + 一句话 + 有序等级列表 | 同左 | 同左 |
| 阶梯 | 只读阶梯，显示 rank 与阶位名 | 完整阶梯：能力 / 规则 / 代价 chip、连线编辑 | 加时间标记、境界达成者数量、分支对比 |
| 节点 | 只显示名称与摘要 | 完整节点详情、复用标记、前置与进阶 | 加量级文本、代价资源流向、统计 |
| 典籍 | 不显示 | 按 rank 的卷册卡片、长文展开 | 加关联摘要与时间线 |
| 关联 | 只显示计数与行内引用；添加默认 `core.related_to` | 完整 LinkPanel + 通用选择器 + 阶梯连线 | 接入世界脉络的体系子图，启用强度/时间维度 |

降档只隐藏、不删除数据；sketch 下已建的节点与关联仍计入计数与 LinkPanel。

---

## 9. 空状态与引导

```
┌──────────────────────────────────┐
│           [layers 48]            │
│          还没有体系              │
│ 从"体系名 + 一句话 + 三行阶位"开始│
│ [ + 新建体系 ] [ 查看关联说明 ]  │
└──────────────────────────────────┘
```

- 模块为空：主按钮开新建表单，次按钮开 6.1 表帮助抽屉；不展示预设体系、示例阶位或世界观类型选择器。
- 体系无阶位：阶梯区显示"添加第一个阶位" + 快速录入入口，也允许"先保存，稍后再加"。
- 节点为空：阶位节点内显示幽灵 chip `[+ 添加能力]`、`[+ 添加规则]`、`[+ 添加代价]`；未填突破条件不阻塞保存。
- 筛选/搜索为空：`[search-x] 没有匹配的体系` + "清空筛选"；LinkPanel 为空时显示"暂无关联"与 `[+ 添加关联]`，不显示空分组标题。

---

## 10. 最小可用路径（3 分钟）

| 时间 | 动作 | 结果 |
|---|---|---|
| 0:00-0:10 | 打开 systems 模块 | 空状态引导（有数据则见体系列表 + 阶梯） |
| 0:10-0:50 | 新建体系，填名称与一句话并保存 | 进入空阶梯，提示添加阶位 |
| 0:50-1:40 | 快速录入三行阶位（如 甲 / 乙 / 丙） | 阶梯出现三个 rank 节点，可拖拽调序 |
| 1:40-2:20 | 给一个阶位加一条能力（自动建 grants） | 阶位节点出现能力 chip，节点可复用 |
| 2:20-2:50 | 在 LinkPanel 加一条关联（角色 / 种族 / 代价资源任一） | 关联计数 +1，目标侧出现反向入链 |
| 2:50-3:00 | 切换到典籍视图确认 | 最小可用的体系进阶完成 |

最短路径的三条约束：必填只有"名称 + 一句话"；阶位支持多行批量录入；能力、代价、关联全部可后补。

---

## 11. 性能与实现建议
- 阶梯按 `meta.rank` 排序并缓存；超过 300 节点只渲染视口内节点与按需连线。
- `advances_to` / `requires` 增量维护拓扑，保存前 DFS 环路检测并给出冲突路径。
- 列表与节点徽章批量聚合 `world_links`；WorldLink 只存 EntityRef，名称批量解析。
- 拖拽排序乐观更新、失败回滚；rank 步长插入必要时归一化；颜色对比达 WCAG AA，动效可关闭。

---

## 12. 本轮不做的事

1. 不写前后端代码，不建数据表，不迁移旧数据。
2. 不预置任何具体体系、阶位、能力、代价或世界观模板（修炼、魔法、科技等只作为用户可创建的示例，不是系统预设）。
3. 不做数值平衡、战斗模拟、公式引擎或自动战力计算；量级只用文本描述。
4. 不做自动生成阶位 / 能力 / 突破条件，不做 AI 文案。
5. 不做跨体系共享节点池：节点归属一个 system，复用通过 `grants` / `costs` 关联表达。
6. 不做地图界面改造；地图未接入时隐藏相关入口，可用通用关联兜底。
7. 不做跨世界关联、公开分享与模板市场。
8. 不做专用打印导出与实时协作；典籍视图只保证可读与可打印的排版基础。
