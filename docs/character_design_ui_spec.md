# 人物设定界面 UI 设计文档

## 1. 概述

### 1.1 设计目标
为 LocalScribe 写作助手创建一个沉浸式、富有文学气质的人物设定管理系统，采用左右分栏布局，左侧人物列表快速浏览，右侧详细编辑，提升创作效率。

### 1.2 设计理念
- **文学气质**：采用古籍卷轴与水墨意境的视觉语言
- **高效浏览**：左侧条形卡片快速定位人物
- **深度编辑**：右侧完整信息自由定制
- **层次分明**：通过视觉权重区分角色重要性

### 1.3 设计原则
1. **一致性**：与世界观设定界面保持统一的视觉语言
2. **灵活性**：小卡片内容高度自定义，不限制字段
3. **可扩展性**：支持从简单角色到复杂多维度人物的渐进式构建
4. **上下文感知**：与章节结构关联，支持按出场筛选

---

## 2. 整体架构

### 2.1 界面位置
```
EditorPage 左侧栏结构：
┌─────────────────────────────────┐
│  目录树区域 (67% 高度)           │
├─────────────────────────────────┤
│  中间功能区                      │
│  ├─ 世界观设定按钮               │
│  ├─ 【人物设定按钮】← 新增       │
│  └─ 大纲按钮                     │
├─────────────────────────────────┤
│  底部操作栏                      │
└─────────────────────────────────┘
```

### 2.2 主界面结构 (左右分栏)
```
主编辑区 (当 showCharacterDesign = true 时):
┌─────────────────────────────────────────────────────────────────────┐
│  顶部导航栏                                                          │
│  ├─ 返回按钮                  人物设定          [子页面: 卡片|云图] │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┬────────────────────────────────────┐ │
│  │                          │                                    │ │
│  │    左侧人物栏 (25%)      │      右侧详情区 (75%)              │ │
│  │                          │                                    │ │
│  │  ┌────────────────────┐  │  ┌──────────────────────────────┐  │ │
│  │  │ 条形人物卡片       │  │  │                              │  │ │
│  │  │ 条形人物卡片       │  │  │    人物完整信息              │  │ │
│  │  │ 条形人物卡片       │  │  │    (小卡片网格布局)          │  │ │
│  │  │ ...                │  │  │                              │  │ │
│  │  └────────────────────┘  │  └──────────────────────────────┘  │ │
│  │                          │                                    │ │
│  │  [+ 新增人物]            │                                    │ │
│  │                          │                                    │ │
│  └──────────────────────────┴────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 状态管理
```typescript
// EditorPage 新增状态
const [showCharacterDesign, setShowCharacterDesign] = useState(false);
const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

// 互斥逻辑
setShowWorldbuilding(false);
setShowTrash(false);
setShowCharacterDesign(true);
```

---

## 3. 视觉设计系统

### 3.1 色彩体系

#### 主色调
| 用途 | 变量名 | 色值 | 说明 |
|------|--------|------|------|
| 主色 | `--primary` | `hsl(30 60% 45%)` | 古籍纸张的暖褐色 |
| 主色前景 | `--primary-foreground` | `hsl(30 10% 98%)` | 米白色文字 |
| 强调色 | `--accent` | `hsl(200 50% 40%)` | 靛青水墨色 |
| 背景色 | `--background` | `hsl(35 30% 96%)` | 宣纸底色 |
| 卡片背景 | `--card` | `hsl(35 25% 98%)` | 略亮的卡片底 |

#### 角色等级色彩 (用于左侧条形卡片)
| 等级 | 边框色 | 背景色 | 左侧条形色 | 说明 |
|------|--------|--------|------------|------|
| 主角 | `hsl(45 90% 55%)` | `hsl(45 90% 97%)` | `hsl(45 90% 55%)` 4px | 金色系 |
| 重要配角 | `hsl(200 60% 55%)` | `hsl(200 60% 97%)` | `hsl(200 60% 55%)` 3px | 青色系 |
| 配角 | `hsl(120 40% 50%)` | `hsl(120 40% 97%)` | `hsl(120 40% 50%)` 2px | 绿色系 |
| 小角色 | `hsl(0 0% 70%)` | `hsl(0 0% 98%)` | `hsl(0 0% 70%)` 2px | 灰色系 |

#### 关系线色彩
| 类型 | 色值 |
|------|------|
| 亲情 | `hsl(120 40% 50%)` |
| 爱情 | `hsl(330 70% 60%)` |
| 友情 | `hsl(200 60% 55%)` |
| 师徒 | `hsl(270 50% 55%)` |
| 敌对 | `hsl(0 60% 50%)` |
| 其他 | `hsl(0 0% 60%)` |

### 3.2 字体系统

| 层级 | 字体 | 大小 | 字重 | 用途 |
|------|------|------|------|------|
| 页面标题 | 系统 serif | 24px | 600 | "人物设定" |
| 人物姓名 | 系统 serif | 18px | 600 | 条形卡片姓名 |
| 人物字号 | sans-serif | 14px | 500 | 字、号显示 |
| 人物外号 | sans-serif | 12px | 400 | 斜体显示 |
| 正文 | sans-serif | 14px | 400 | 描述文字 |
| 小标签 | sans-serif | 11px | 500 | 属性标签 |

### 3.3 间距系统

| 名称 | 值 | 用途 |
|------|-----|------|
| xs | 4px | 图标间隙 |
| sm | 8px | 紧凑间距 |
| md | 16px | 标准间距 |
| lg | 24px | 区块间距 |
| xl | 32px | 大区块分隔 |

### 3.4 圆角与阴影

```css
/* 条形卡片圆角 */
--bar-card-radius: 8px;

/* 小卡片圆角 */
--info-card-radius: 10px;

/* 柔和阴影 */
--card-shadow: 0 1px 4px hsl(30 20% 20% / 0.06);
--card-shadow-hover: 0 2px 8px hsl(30 20% 20% / 0.1);
--card-shadow-active: 0 0 0 2px hsl(30 60% 45% / 0.3);
```

---

## 4. 左侧人物栏 (25%)

### 4.1 布局结构
```
左侧人物栏:
┌─────────────────────────────────┐
│  🔍 搜索人物...                 │
├─────────────────────────────────┤
│  [全部] [主角] [重要配角] [筛选▼]│
├─────────────────────────────────┤
│  ┌─────────────────────────────┐│
│  │ █ 主角条形卡片              ││  ← 金色左边条 4px
│  ├─────────────────────────────┤│
│  │ █ 重要配角条形卡片          ││  ← 青色左边条 3px
│  ├─────────────────────────────┤│
│  │ █ 配角条形卡片              ││  ← 绿色左边条 2px
│  ├─────────────────────────────┤│
│  │ █ 小角色条形卡片            ││  ← 灰色左边条 2px
│  ├─────────────────────────────┤│
│  │ ...                         ││
│  └─────────────────────────────┘│
│                                 │
│  [+ 新增人物]                   │
└─────────────────────────────────┘
```

### 4.2 条形人物卡片

#### 尺寸与布局 (按等级区分)

| 等级 | 卡片高度 | 内边距 | 头像尺寸 | 说明 |
|------|----------|--------|----------|------|
| 主角 | 88px | 14px | 60px × 60px | 最大尺寸，突出重要性 |
| 重要配角 | 80px | 12px | 56px × 56px | 较大尺寸 |
| 配角 | 72px | 12px | 48px × 48px | 标准尺寸 |
| 小角色 | 64px | 10px | 44px × 44px | 最小尺寸 |

- **宽度**: 100% (填满容器)
- **间距**: 8px (卡片之间)

#### 视觉结构
```
主角卡片样式 (88px 高, 60px 头像):
┌─────────────────────────────────────┐
│┌────────┐  张三·字子明              │
││        │  号：青莲居士             │
││  人物  │  外号：剑痴·张疯子        │
││  头像  │  称号：天下第一剑客       │
││  60x60 │  ─────────────────────    │
││        │  男 | 甲子年三月初三      │
│└────────┘  卷一·幕一·章三 出场     │
│            "一剑霜寒十四州"         │
└─────────────────────────────────────┘

重要配角卡片样式 (80px 高, 56px 头像):
┌─────────────────────────────────────┐
│┌────────┐  李四                     │
││  人物  │  外号：铁掌水上漂         │
││  头像  │  ─────────────────────    │
││  56x56 │  男 | 乙丑年              │
│└────────┘  卷一·幕二·章五 出场     │
│            "掌风所至，水波不兴"     │
└─────────────────────────────────────┘

配角卡片样式 (72px 高, 48px 头像):
┌─────────────────────────────────────┐
│┌──────┐  王五                       │
││ 人物 │  ─────────────────────      │
││ 头像 │  男 | 丙寅年                │
││ 48x48│  卷二·幕一·章三 出场       │
│└──────┘                              │
└─────────────────────────────────────┘

小角色卡片样式 (64px 高, 44px 头像):
┌─────────────────────────────────────┐
│┌──────┐  店小二                     │
││人物  │  ─────────────────────      │
││44x44 │  男 | 年龄不详              │
│└──────┘  卷一·幕三·章二 出场       │
└─────────────────────────────────────┘
```

#### 组件规范

**人物头像 (按等级区分)**
```
主角: 60px × 60px, 圆角 8px
重要配角: 56px × 56px, 圆角 7px
配角: 48px × 48px, 圆角 6px
小角色: 44px × 44px, 圆角 5px

背景: 渐变占位
空状态: 显示首字
```

**姓名行**
```
姓名: 18px, font-weight 600, serif
字号: 14px, font-weight 500, 主色 (如·字子明)
```

**称号信息 (可选，自由定义)**
```
号: 14px, 次要色
外号: 12px, 斜体, 次要色
称号: 12px, 金色 (主角/重要配角)

所有称号类信息存储在 aliases 数组中，类型自由标记
```

**基础信息行**
```
性别 | 生辰: 12px, 次要色
出场: 12px, 次要色, 可点击跳转
判词: 12px, 斜体, 次要色, 引号包裹
```

#### 交互行为

| 状态 | 效果 |
|------|------|
| 默认 | 正常显示，轻微阴影 |
| 悬浮 | 阴影加深，背景色略微加深 |
| 选中 | 外圈 2px 主色描边，背景色加深 |
| 点击 | 右侧显示该人物详情 |

---

## 5. 右侧详情区 (75%)

### 5.1 布局结构
```
右侧详情区:
┌─────────────────────────────────────────────────────────────────┐
│  [编辑] [删除]                                            [×]   │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  头部区域                                                  │  │
│  │  ┌────────────┐  ┌─────────────────────────────────────┐  │  │
│  │  │            │  │  张三                               │  │  │
│  │  │   人物     │  │  字子明 · 号青莲居士                │  │  │
│  │  │   形象     │  │  外号：剑痴 · 称号：天下第一剑客    │  │  │
│  │  │   图片     │  │  ─────────────────────────────────  │  │  │
│  │  │  180x220   │  │  男 | 甲子年三月初三 | 江南人士     │  │  │
│  │  │            │  │  卷一·幕一·章三 首次出场            │  │  │
│  │  └────────────┘  │  "一剑霜寒十四州"                   │  │  │
│  │                  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  小卡片区域 (两列布局)                                     │  │
│  │                                                            │  │
│  │  ┌─────────────┐  ┌─────────────┐                        │  │
│  │  │ 基础信息    │  │ 外貌特征    │                        │  │
│  │  │ (自定义内容)│  │ (自定义内容)│                        │  │
│  │  └─────────────┘  └─────────────┘                        │  │
│  │  ┌─────────────┐  ┌─────────────┐                        │  │
│  │  │ 性格画像    │  │ 声音口癖    │                        │  │
│  │  │ (自定义内容)│  │ (自定义内容)│                        │  │
│  │  └─────────────┘  └─────────────┘                        │  │
│  │  ┌─────────────┐  ┌─────────────┐                        │  │
│  │  │ 背景故事    │  │ 核心信念    │                        │  │
│  │  │ (自定义内容)│  │ (自定义内容)│                        │  │
│  │  └─────────────┘  └─────────────┘                        │  │
│  │  ┌─────────────────────────────┐                         │  │
│  │  │ 器物 (横向滚动)             │                         │  │
│  │  └─────────────────────────────┘                         │  │
│  │  ┌─────────────────────────────┐                         │  │
│  │  │ 人物关系 (列表)             │                         │  │
│  │  └─────────────────────────────┘                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 头部区域

**人物形象**
- 尺寸: 180px × 220px
- 圆角: 10px
- 边框: 2px solid hsl(30 20% 88%)
- 阴影: --card-shadow

**信息组**
```
姓名: 28px, font-weight 700, serif
字号: 16px, font-weight 500, 主色
号/外号/称号: 14px, 次要色，可自由组合显示

基础信息: 14px, 次要色
出场: 14px, 可点击，accent色
判词: 16px, 斜体, 次要色
```

### 5.3 信息小卡片 (两列布局)

#### 小卡片容器规范
```
布局: CSS Grid, 2列
间距: 16px
每卡片:
- 宽度: 自适应 (50% - 8px)
- 高度: 自适应 (根据内容)
- 圆角: 10px
- 背景: hsl(35 28% 96%)
- 边框: 1px solid hsl(30 20% 90%)
- 内边距: 16px
```

#### 小卡片结构
```
┌─────────────────────────────────┐
│  📋 基础信息          [编辑图标] │  ← 标题栏
├─────────────────────────────────┤
│                                 │
│  卡片内容区域：                  │
│  - 完全自定义的键值对            │
│  - 支持富文本                    │
│  - 支持列表                      │
│  - 支持图片                      │
│                                 │
│  姓名：张三                      │
│  字：子明                        │
│  号：青莲居士                    │
│  性别：男                        │
│  生辰：甲子年三月初三            │
│  出生地：江南水乡                │
│  ...                             │
│                                 │
└─────────────────────────────────┘
```

#### 小卡片标题栏
```
高度: 40px
左侧: 图标 + 标题
右侧: [编辑] 按钮 (悬浮显示)

标题: 14px, font-weight 600
图标: 20px, 主色
```

#### 小卡片内容区
```
完全自定义，不限制字段：
- 键值对形式 (标签: 值)
- 富文本段落
- 图片展示
- 时间线
- 列表
- 关键词标签

字段由用户自由添加、删除、命名
```

### 5.4 角色等级与显示内容

#### 主角 / 重要配角 (显示完整)
```
默认小卡片:
├─ 📋 基础信息 (可自定义字段)
├─ 🎭 外貌特征 (富文本)
├─ 🎨 性格画像 (关键词 + 描述)
├─ 🗣️ 声音口癖 (音色语速 + 口癖列表)
├─ 📖 背景故事 (时间线)
├─ 💫 核心信念 (信念 + 动机层次)
├─ 🏺 器物 (横向滚动列表)
└─ 🔗 人物关系 (关系列表)

所有小卡片可：
- 添加新卡片
- 删除现有卡片
- 重命名卡片标题
- 调整卡片内字段
- 调整卡片顺序
```

#### 配角 / 小角色 (精简显示)
```
默认小卡片:
├─ 📋 基础信息 (精简字段)
├─ 🎭 外貌特征 (可选)
├─ 🎨 性格画像 (仅关键词)
└─ 📖 背景故事 (简要)

限制:
- 不显示器物卡片
- 不显示人物关系卡片
- 不可添加自定义卡片
- 编辑时提示"提升为重要角色以解锁更多功能"
```

### 5.5 小卡片编辑模式

#### 编辑弹窗
```
┌─────────────────────────────────────────┐
│  编辑：基础信息                  [×]    │
├─────────────────────────────────────────┤
│                                         │
│  卡片标题: [基础信息        ]           │
│                                         │
│  字段列表:                              │
│  ┌─────────────────────────────────┐    │
│  │ 姓名: [张三               ] [×] │    │
│  │ 字:   [子明               ] [×] │    │
│  │ 号:   [青莲居士          ] [×] │    │
│  │ 性别: [男 ▼]                    │    │
│  │ 生辰: [甲子年三月初三    ] [×] │    │
│  │ [+ 添加字段]                    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  字段类型: [文本 ▼] [数字 ▼] [日期 ▼]   │
│                                         │
│  [删除卡片]        [取消]  [保存]       │
│                                         │
└─────────────────────────────────────────┘
```

#### 添加字段
```
字段类型选项:
├─ 单行文本
├─ 多行文本
├─ 数字
├─ 日期
├─ 下拉选择
├─ 关键词标签
├─ 图片
└─ 富文本
```

---

## 6. 新增人物流程

### 6.1 创建弹窗 (简化版)
```
┌─────────────────────────────────────────┐
│  新增人物                         [×]   │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  人物等级:                      │    │
│  │  [● 主角] [重要配角] [配角] [小角色] │    │
│  └─────────────────────────────────┘    │
│                                         │
│  姓名: [________________] *             │
│                                         │
│  字/号/外号: [________________]         │
│  (可添加多个，用空格分隔)               │
│                                         │
│  性别: [男 ▼]                           │
│                                         │
│  判词: [________________]               │
│  (一句话概括人物)                       │
│                                         │
│  [取消]              [创建]             │
│                                         │
└─────────────────────────────────────────┘
```

### 6.2 创建后流程
```
1. 创建成功后，左侧列表自动刷新
2. 自动选中新创建的人物
3. 右侧显示该人物详情 (空白模板)
4. 显示引导提示："点击各区域编辑人物信息"
```

---

## 7. 错误提示设计

### 7.1 错误类型与提示方式

| 错误类型 | 提示方式 | 位置 |
|----------|----------|------|
| 网络错误 | Toast 通知 | 右上角 |
| 保存失败 | 行内错误 + 重试按钮 | 操作区域 |
| 表单验证错误 | 字段下方红色文字 | 对应字段 |
| 图片上传失败 | 上传区域错误提示 | 上传组件 |
| 删除确认 | 确认弹窗 | 居中弹窗 |

### 7.2 错误提示组件

**Toast 通知**
```
┌─────────────────────────────────────────┐
│  ⚠️ 保存失败，请检查网络连接      [×]   │
│     [重试]                              │
└─────────────────────────────────────────┘
位置: 右上角
动画: 从右侧滑入
```

**行内错误**
```
┌─────────────────────────────────────────┐
│  姓名: [________________]               │
│        ⚠️ 姓名不能为空                  │
└─────────────────────────────────────────┘
颜色: hsl(0 70% 50%)
字体: 12px
```

### 7.3 错误处理策略

**自动重试**
- 网络错误自动重试 3 次
- 每次间隔 1s, 2s, 4s

**本地草稿**
- 保存失败时自动保存到 localStorage
- 下次打开时提示恢复

---

## 8. 加载状态设计

### 8.1 左侧人物栏骨架屏
```
┌─────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
├─────────────────────────────────┤
│  ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓           │
├─────────────────────────────────┤
│  ┌────────┐  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │  ← 主角骨架 (88px 高, 60px 头像)
│  │ ▓▓▓▓▓▓ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
│  │ ▓▓▓▓▓▓ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
│  │ ▓▓▓▓▓▓ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
│  │ ▓▓▓▓▓▓ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
│  └────────┘  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
├─────────────────────────────────┤
│  ┌────────┐  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓     │  ← 重要配角骨架 (80px 高, 56px 头像)
│  │ ▓▓▓▓▓▓ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓     │
│  │ ▓▓▓▓▓▓ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓     │
│  │ ▓▓▓▓▓▓ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓     │
│  └────────┘  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓     │
├─────────────────────────────────┤
│  ┌──────┐  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓       │  ← 配角骨架 (72px 高, 48px 头像)
│  │ ▓▓▓▓ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓       │
│  │ ▓▓▓▓ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓       │
│  └──────┘  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓       │
├─────────────────────────────────┤
│  ┌──────┐  ▓▓▓▓▓▓▓▓▓▓▓▓         │  ← 小角色骨架 (64px 高, 44px 头像)
│  │ ▓▓▓▓ │  ▓▓▓▓▓▓▓▓▓▓▓▓         │
│  └──────┘  ▓▓▓▓▓▓▓▓▓▓▓▓         │
├─────────────────────────────────┤
│  ... (重复5-8条, 混合各等级)    │
└─────────────────────────────────┘

动画: shimmer 脉冲渐变
骨架尺寸与对应等级卡片一致
```

### 8.2 右侧详情区骨架屏
```
分段加载:
1. 头部区域骨架
   - 图片骨架 180x220
   - 文字骨架 多行
2. 小卡片网格骨架 (2x3)
   - 每个卡片骨架
3. 器物/关系区域骨架

每个区域独立加载，完成后替换为实际内容
```

### 8.3 图片上传进度
```
┌─────────────────────────────────────────┐
│  📤 上传人物图片...                     │
│  ████████████████████▓▓▓▓  78%         │
│  2.3 MB / 3.0 MB                        │
│  [取消上传]                             │
└─────────────────────────────────────────┘
```

---

## 9. 空状态设计

### 9.1 无人物状态 (左侧栏)
```
┌─────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
├─────────────────────────────────┤
│                                 │
│                                 │
│           🎭                    │
│                                 │
│      还没有创建人物             │
│                                 │
│      开始构建你的               │
│      角色阵容吧                 │
│                                 │
│      [+ 创建第一个人物]         │
│                                 │
│                                 │
└─────────────────────────────────┘
```

### 9.2 筛选无结果 (左侧栏)
```
┌─────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
├─────────────────────────────────┤
│  [全部] [主角] [重要配角] [筛选▼]│
├─────────────────────────────────┤
│                                 │
│           🔍                    │
│                                 │
│      没有找到匹配的人物         │
│                                 │
│      尝试调整筛选条件           │
│                                 │
│      [清除筛选]                 │
│                                 │
└─────────────────────────────────┘
```

### 9.3 右侧详情区空状态 (未选择人物)
```
┌─────────────────────────────────────────────────────────────────┐
│                                                           [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│                         👤                                      │
│                                                                 │
│              选择左侧人物查看详情                               │
│                                                                 │
│              或创建一个新人物开始                               │
│                                                                 │
│              [+ 新增人物]                                       │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.4 搜索无结果
```
┌─────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
├─────────────────────────────────┤
│  🔍 [关键词                ] [×] │
├─────────────────────────────────┤
│                                 │
│           🔍                    │
│                                 │
│      没有找到与 "关键词"        │
│      相关的人物                 │
│                                 │
│      搜索范围：姓名、字、号、   │
│      外号、称号、判词           │
│                                 │
│      [清除搜索]                 │
│                                 │
└─────────────────────────────────┘
```

---

## 10. 数据结构

### 10.1 人物数据模型
```typescript
interface Character {
  id: string;
  projectId: string;
  
  // 人物等级 (替代角色类型)
  importanceLevel: 'protagonist' | 'major_supporting' | 'supporting' | 'minor';
  
  // 基础信息
  name: string;             // 姓名
  aliases: Alias[];         // 字、号、外号、称号等 (自由定义)
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;       // 生辰
  birthplace?: string;      // 出生地
  age?: number;
  ageDescription?: string;
  
  // 出场位置
  appearances: Appearance[];
  
  // 判词
  epithet?: string;
  
  // 视觉
  avatar?: string;
  
  // 自定义小卡片 (主角/重要配角才有)
  infoCards?: InfoCard[];
  
  // 器物ID列表
  artifactIds: string[];
  
  // 关系ID列表
  relationshipIds: string[];
  
  // 元数据
  createdAt: string;
  updatedAt: string;
  order: number;
}

// 别名结构 (自由定义类型)
interface Alias {
  id: string;
  type: string;        // "字" | "号" | "外号" | "称号" | 自定义
  value: string;       // 值
  order: number;       // 排序
}

// 小卡片结构
interface InfoCard {
  id: string;
  title: string;       // 卡片标题
  icon?: string;       // 图标
  fields: InfoField[]; // 字段列表
  order: number;       // 排序
}

// 字段结构
interface InfoField {
  id: string;
  label: string;       // 字段标签 (用户自定义)
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tags' | 'image' | 'richtext';
  value: any;          // 值
  order: number;       // 排序
}

interface Appearance {
  id: string;
  volumeId?: string;
  actId?: string;
  chapterId?: string;
  volumeName?: string;
  actName?: string;
  chapterName?: string;
  isFirst?: boolean;    // 是否首次出场
  description?: string;
}
```

### 10.2 别名类型示例
```typescript
// 用户可以完全自定义类型
const aliasExamples = [
  { type: "字", value: "子明" },
  { type: "号", value: "青莲居士" },
  { type: "外号", value: "剑痴" },
  { type: "外号", value: "张疯子" },
  { type: "称号", value: "天下第一剑客" },
  { type: "谥号", value: "忠武" },        // 自定义类型
  { type: "乳名", value: "阿三" },        // 自定义类型
  { type: "诨名", value: "铁掌水上漂" },   // 自定义类型
];
```

### 10.3 小卡片模板 (按等级)

#### 主角/重要配角默认模板
```typescript
const protagonistTemplate: InfoCard[] = [
  {
    title: "基础信息",
    icon: "📋",
    fields: [
      { label: "姓名", type: "text", value: "" },
      { label: "性别", type: "select", value: "" },
      { label: "生辰", type: "text", value: "" },
      { label: "出生地", type: "text", value: "" },
    ]
  },
  {
    title: "外貌特征",
    icon: "🎭",
    fields: [
      { label: "描述", type: "richtext", value: "" },
    ]
  },
  {
    title: "性格画像",
    icon: "🎨",
    fields: [
      { label: "关键词", type: "tags", value: [] },
      { label: "描述", type: "textarea", value: "" },
    ]
  },
  {
    title: "声音口癖",
    icon: "🗣️",
    fields: [
      { label: "音色", type: "text", value: "" },
      { label: "语速", type: "text", value: "" },
      { label: "口癖", type: "tags", value: [] },
    ]
  },
  {
    title: "背景故事",
    icon: "📖",
    fields: [
      { label: "经历", type: "richtext", value: "" },
    ]
  },
  {
    title: "核心信念",
    icon: "💫",
    fields: [
      { label: "信念", type: "textarea", value: "" },
      { label: "动机", type: "textarea", value: "" },
    ]
  },
];
```

#### 配角/小角色默认模板
```typescript
const supportingTemplate: InfoCard[] = [
  {
    title: "基础信息",
    icon: "📋",
    fields: [
      { label: "姓名", type: "text", value: "" },
      { label: "性别", type: "select", value: "" },
      { label: "简介", type: "textarea", value: "" },
    ]
  },
  {
    title: "外貌特征",
    icon: "🎭",
    fields: [
      { label: "描述", type: "textarea", value: "" },
    ]
  },
];
// 限制：不可添加新卡片，不可编辑卡片结构
```

### 10.4 API 接口设计
```typescript
// 人物 CRUD
GET    /api/v1/projects/:projectId/characters
POST   /api/v1/projects/:projectId/characters
GET    /api/v1/characters/:characterId
PUT    /api/v1/characters/:characterId
DELETE /api/v1/characters/:characterId

// 搜索接口
GET    /api/v1/projects/:projectId/characters/search?q=关键词

// 筛选接口
GET    /api/v1/projects/:projectId/characters?level=protagonist&range=...

// 小卡片操作
PUT    /api/v1/characters/:characterId/cards
POST   /api/v1/characters/:characterId/cards
DELETE /api/v1/characters/:characterId/cards/:cardId

// 关系
GET    /api/v1/projects/:projectId/relationships
POST   /api/v1/projects/:projectId/relationships

// 器物
GET    /api/v1/projects/:projectId/artifacts
```

---

## 11. 组件清单

### 11.1 新增组件
| 组件名 | 路径 | 说明 |
|--------|------|------|
| CharacterDesignView | `components/CharacterDesign/` | 主视图容器 (左右分栏) |
| CharacterSidebar | `components/CharacterDesign/` | 左侧人物栏 |
| CharacterBarCard | `components/CharacterDesign/` | 条形人物卡片 |
| CharacterDetail | `components/CharacterDesign/` | 右侧详情区 |
| InfoCard | `components/CharacterDesign/` | 信息小卡片 |
| InfoCardGrid | `components/CharacterDesign/` | 小卡片网格布局 |
| InfoCardEditor | `components/CharacterDesign/` | 小卡片编辑器 |
| AliasDisplay | `components/CharacterDesign/` | 别名显示组件 |
| AliasEditor | `components/CharacterDesign/` | 别名编辑器 |
| ArtifactList | `components/CharacterDesign/` | 器物列表 (横向滚动) |
| RelationshipList | `components/CharacterDesign/` | 关系列表 |
| ImportanceBadge | `components/CharacterDesign/` | 等级标识 |
| SearchInput | `components/CharacterDesign/` | 搜索输入框 |
| SkeletonBarCard | `components/CharacterDesign/` | 条形卡片骨架屏 |
| SkeletonInfoCard | `components/CharacterDesign/` | 信息卡片骨架屏 |
| EmptyState | `components/CharacterDesign/` | 空状态组件 |
| ErrorToast | `components/CharacterDesign/` | 错误提示 |
| ImageUploader | `components/CharacterDesign/` | 图片上传 |

---

## 12. 依赖项

### 12.1 新增依赖
```json
{
  "d3": "^7.8.5",
  "d3-force": "^3.0.0"
}
```

### 12.2 图标 (Lucide)
- `Users` - 人物设定按钮
- `User` - 人物默认头像
- `Crown` - 主角标识
- `Star` - 重要配角标识
- `UserCircle` - 配角标识
- `User` - 小角色标识
- `Sword` - 武器类型
- `Shield` - 防具类型
- `Gem` - 饰品类型
- `Sparkles` - 法器类型
- `BookOpen` - 书籍类型
- `Box` - 其他器物
- `GitBranch` - 关系图标
- `Network` - 云图图标
- `MapPin` - 出场位置
- `Search` - 搜索
- `Filter` - 筛选
- `Plus` - 添加
- `Edit3` - 编辑
- `Trash2` - 删除
- `AlertCircle` - 错误
- `Loader2` - 加载中
- `Upload` - 上传
- `X` - 关闭

---

## 13. 实现建议

### 13.1 开发顺序
1. **基础架构**: EditorPage 集成、左右分栏布局
2. **数据层**: API 接口、数据模型、React Query hooks
3. **左侧栏**: CharacterSidebar、CharacterBarCard、搜索筛选
4. **右侧详情**: CharacterDetail、InfoCard、小卡片编辑
5. **别名系统**: AliasDisplay、AliasEditor
6. **器物/关系**: ArtifactList、RelationshipList
7. **关系图**: RelationshipGraph、D3 集成
8. **优化**: 骨架屏、错误处理、空状态

### 13.2 性能考虑
- 人物列表使用虚拟滚动 (react-window) 当数量 > 50
- 小卡片内容懒加载
- 图片懒加载
- 搜索防抖 300ms

### 13.3 测试要点
- 人物 CRUD 流程
- 别名增删改查
- 小卡片自定义编辑
- 等级切换 (主角↔配角)
- 筛选器联动
- 关联跳转
- 图片上传

---

## 附录 A: 设计参考

### A.1 色彩参考
- 古籍纸张: `#f5f0e6`
- 水墨靛青: `#2c4a6b`
- 朱砂: `#c9372c`
- 金箔: `#d4a84b`

### A.2 布局参考
- 左侧列表: Notion 数据库视图
- 小卡片: Trello 卡片 / Notion 页面
- 详情页: Craft 文档编辑器

---

## 14. 后端实现

### 14.1 数据库架构

#### 14.1.1 表结构设计

**人物主表 (characters)**
```sql
CREATE TABLE characters (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    gender VARCHAR(20) DEFAULT 'unknown',
    birth_date VARCHAR(100),
    birthplace VARCHAR(255),
    level VARCHAR(20) DEFAULT 'minor',
    quote TEXT,
    avatar VARCHAR(500),
    full_image VARCHAR(500),
    first_appearance_volume VARCHAR(100),
    first_appearance_act VARCHAR(100),
    first_appearance_chapter VARCHAR(100),
    order_index INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_characters_project (project_id),
    INDEX idx_characters_name (name),
    INDEX idx_characters_level (level)
);
```

**别名表 (character_aliases)**
```sql
CREATE TABLE character_aliases (
    id VARCHAR(36) PRIMARY KEY,
    character_id VARCHAR(36) NOT NULL,
    alias_type VARCHAR(50) NOT NULL,
    content VARCHAR(255) NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME,
    
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_aliases_character (character_id)
);
```

**信息小卡片表 (character_cards)**
```sql
CREATE TABLE character_cards (
    id VARCHAR(36) PRIMARY KEY,
    character_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    icon VARCHAR(100),
    content JSON,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME,
    
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_cards_character (character_id)
);
```

**人物关系表 (character_relationships)**
```sql
CREATE TABLE character_relationships (
    id VARCHAR(36) PRIMARY KEY,
    character_id VARCHAR(36) NOT NULL,
    target_character_id VARCHAR(36),
    target_name VARCHAR(255),
    relation_type VARCHAR(50) NOT NULL,
    description TEXT,
    strength INTEGER DEFAULT 50,
    is_bidirectional BOOLEAN DEFAULT TRUE,
    reverse_description TEXT,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME,
    
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (target_character_id) REFERENCES characters(id) ON DELETE SET NULL,
    INDEX idx_relationships_character (character_id),
    INDEX idx_relationships_target (target_character_id)
);
```

**器物表 (character_artifacts)**
```sql
CREATE TABLE character_artifacts (
    id VARCHAR(36) PRIMARY KEY,
    character_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    artifact_type VARCHAR(100),
    image VARCHAR(500),
    order_index INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME,
    
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_artifacts_character (character_id)
);
```

#### 14.1.2 枚举类型

**角色等级 (CharacterLevel)**
```python
class CharacterLevel(str, Enum):
    PROTAGONIST = "protagonist"      # 主角
    MAJOR_SUPPORT = "major_support"  # 重要配角
    SUPPORT = "support"              # 配角
    MINOR = "minor"                  # 小角色
```

**性别 (CharacterGender)**
```python
class CharacterGender(str, Enum):
    MALE = "male"          # 男
    FEMALE = "female"      # 女
    OTHER = "other"        # 其他
    UNKNOWN = "unknown"    # 未知
```

**别名类型 (AliasType)**
```python
class AliasType(str, Enum):
    ZI = "zi"              # 字
    HAO = "hao"            # 号
    NICKNAME = "nickname"  # 外号
    TITLE = "title"        # 称号
    OTHER = "other"        # 其他
```

**关系类型 (RelationType)**
```python
class RelationType(str, Enum):
    FAMILY = "family"      # 亲情
    LOVE = "love"          # 爱情
    FRIEND = "friend"      # 友情
    MENTOR = "mentor"      # 师徒
    ENEMY = "enemy"        # 敌对
    OTHER = "other"        # 其他
```

**器物类型 (ArtifactType)**
```python
class ArtifactType(str, Enum):
    WEAPON = "weapon"      # 武器
    ARMOR = "armor"        # 防具
    ACCESSORY = "accessory"  # 饰品
    TREASURE = "treasure"  # 法宝
    OTHER = "other"        # 其他
```

### 14.2 API 接口设计

#### 14.2.1 RESTful 端点清单

**人物主接口**
```
GET    /api/v1/projects/{project_id}/characters
       获取人物列表（支持筛选、搜索、排序）

POST   /api/v1/projects/{project_id}/characters
       创建新人物（含关联数据）

GET    /api/v1/projects/{project_id}/characters/{character_id}
       获取人物详情

PUT    /api/v1/projects/{project_id}/characters/{character_id}
       更新人物信息

DELETE /api/v1/projects/{project_id}/characters/{character_id}
       删除人物（级联删除关联数据）

POST   /api/v1/projects/{project_id}/characters/batch-delete
       批量删除人物

POST   /api/v1/projects/{project_id}/characters/batch-update-order
       批量更新排序
```

**别名管理**
```
GET    /api/v1/projects/{project_id}/characters/{character_id}/aliases
       获取别名列表

POST   /api/v1/projects/{project_id}/characters/{character_id}/aliases
       添加别名

PUT    /api/v1/projects/{project_id}/characters/{character_id}/aliases/{alias_id}
       更新别名

DELETE /api/v1/projects/{project_id}/characters/{character_id}/aliases/{alias_id}
       删除别名
```

**卡片管理**
```
GET    /api/v1/projects/{project_id}/characters/{character_id}/cards
       获取卡片列表

POST   /api/v1/projects/{project_id}/characters/{character_id}/cards
       添加卡片

PUT    /api/v1/projects/{project_id}/characters/{character_id}/cards/{card_id}
       更新卡片

DELETE /api/v1/projects/{project_id}/characters/{character_id}/cards/{card_id}
       删除卡片
```

**关系管理**
```
GET    /api/v1/projects/{project_id}/characters/{character_id}/relationships
       获取关系列表

POST   /api/v1/projects/{project_id}/characters/{character_id}/relationships
       添加关系

PUT    /api/v1/projects/{project_id}/characters/{character_id}/relationships/{relationship_id}
       更新关系

DELETE /api/v1/projects/{project_id}/characters/{character_id}/relationships/{relationship_id}
       删除关系
```

**器物管理**
```
GET    /api/v1/projects/{project_id}/characters/{character_id}/artifacts
       获取器物列表

POST   /api/v1/projects/{project_id}/characters/{character_id}/artifacts
       添加器物

PUT    /api/v1/projects/{project_id}/characters/{character_id}/artifacts/{artifact_id}
       更新器物

DELETE /api/v1/projects/{project_id}/characters/{character_id}/artifacts/{artifact_id}
       删除器物
```

**统计接口**
```
GET    /api/v1/projects/{project_id}/characters/stats
       获取人物统计数据（总数、按等级统计、按性别统计）
```

**选择器接口**
```
GET    /api/v1/projects/{project_id}/characters/simple
       获取人物简要列表（用于关系选择器）
       参数：exclude_id - 排除的人物ID
```

#### 14.2.2 请求/响应示例

**创建人物请求**
```json
{
  "name": "张三",
  "gender": "male",
  "birth_date": "甲子年三月初三",
  "birthplace": "江南水乡",
  "level": "protagonist",
  "quote": "一剑霜寒十四州",
  "avatar": "/uploads/avatars/zhangsan.jpg",
  "first_appearance_volume": "卷一",
  "first_appearance_act": "幕一",
  "first_appearance_chapter": "章三",
  "order_index": 0,
  "aliases": [
    {
      "alias_type": "zi",
      "content": "子明",
      "order_index": 0
    },
    {
      "alias_type": "hao",
      "content": "青莲居士",
      "order_index": 1
    }
  ],
  "cards": [
    {
      "title": "基础信息",
      "icon": "📋",
      "content": [
        {"key": "姓名", "value": "张三", "type": "text"},
        {"key": "字", "value": "子明", "type": "text"}
      ],
      "order_index": 0
    }
  ],
  "relationships": [
    {
      "target_character_id": "char-uuid-2",
      "relation_type": "friend",
      "description": "生死之交",
      "strength": 90,
      "is_bidirectional": true,
      "order_index": 0
    }
  ],
  "artifacts": [
    {
      "name": "青莲剑",
      "description": "上古神兵",
      "artifact_type": "weapon",
      "image": "/uploads/artifacts/qinglian.jpg",
      "order_index": 0
    }
  ]
}
```

**人物详情响应**
```json
{
  "id": "char-uuid-1",
  "project_id": "proj-uuid-1",
  "name": "张三",
  "gender": "male",
  "birth_date": "甲子年三月初三",
  "birthplace": "江南水乡",
  "level": "protagonist",
  "quote": "一剑霜寒十四州",
  "avatar": "/uploads/avatars/zhangsan.jpg",
  "full_image": "/uploads/full/zhangsan.jpg",
  "first_appearance_volume": "卷一",
  "first_appearance_act": "幕一",
  "first_appearance_chapter": "章三",
  "order_index": 0,
  "aliases": [
    {
      "id": "alias-uuid-1",
      "character_id": "char-uuid-1",
      "alias_type": "zi",
      "content": "子明",
      "order_index": 0,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "cards": [...],
  "relationships": [...],
  "artifacts": [...],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 14.3 性能优化

#### 14.3.1 数据库查询优化

**预加载关联数据**
```python
# 使用 selectinload 避免 N+1 查询
query = db.query(Character).options(
    selectinload(Character.aliases),
    selectinload(Character.cards),
    selectinload(Character.artifacts),
    selectinload(Character.relationships).selectinload(
        CharacterRelationship.target_character
    )
)
```

**搜索优化**
```python
# 使用子查询避免 JOIN 导致的重复记录
search_pattern = f"%{search}%"
alias_subquery = (
    db.query(CharacterAlias.character_id)
    .filter(CharacterAlias.content.ilike(search_pattern))
    .subquery()
)
query = query.filter(
    or_(
        Character.name.ilike(search_pattern),
        Character.id.in_(alias_subquery),
    )
)
```

#### 14.3.2 索引策略

**关键字段索引**
- `characters.project_id` - 项目查询
- `characters.name` - 姓名搜索
- `characters.level` - 等级筛选
- `character_aliases.character_id` - 别名关联
- `character_relationships.character_id` - 关系查询
- `character_relationships.target_character_id` - 反向关系查询

### 14.4 数据验证

#### 14.4.1 Pydantic Schema 验证

**字段长度验证**
```python
name: str = Field(..., min_length=1, max_length=255, description="姓名")
content: str = Field(..., min_length=1, max_length=255, description="别名内容")
```

**数值范围验证**
```python
strength: int = Field(50, ge=0, le=100, description="关系强度 0-100")
order_index: int = Field(0, ge=0, description="排序索引")
```

**枚举值验证**
```python
level: CharacterLevel = Field(CharacterLevel.MINOR, description="角色等级")
gender: CharacterGender = Field(CharacterGender.UNKNOWN, description="性别")
```

### 14.5 级联删除策略

**删除人物时自动删除**
- 所有别名 (`cascade="all, delete-orphan"`)
- 所有卡片 (`cascade="all, delete-orphan"`)
- 所有人物关系 (`cascade="all, delete-orphan"`)
- 所有器物 (`cascade="all, delete-orphan"`)

**删除目标人物时**
- 关系记录保留，`target_character_id` 设为 NULL (`ondelete='SET NULL'`)
- `target_name` 字段保留，确保关系描述仍然有效

### 14.6 错误处理

**标准错误响应**
```json
{
  "detail": "人物不存在: char-uuid-1"
}
```

**HTTP 状态码**
- `200 OK` - 成功
- `201 Created` - 创建成功
- `204 No Content` - 删除成功
- `400 Bad Request` - 请求参数错误
- `404 Not Found` - 资源不存在
- `500 Internal Server Error` - 服务器错误

### 14.7 日志记录

**关键操作日志**
```python
logger.info(f"创建人物成功: {character.name} (ID: {character.id})")
logger.info(f"更新人物成功: {character.name} (ID: {character.id})")
logger.info(f"删除人物成功: {character_id}")
logger.error(f"创建人物失败: {str(e)}")
```

### 14.8 实现文件清单

**后端文件**
```
backend/app/
├── models/
│   └── character.py          # 数据库模型
├── schemas/
│   └── character.py          # Pydantic Schemas
├── api/v1/
│   └── characters.py         # API 路由
└── migrations/versions/
    └── xxx_add_character_system_tables.py  # 数据库迁移
```

**前端文件（待实现）**
```
frontend/src/
├── components/
│   ├── CharacterSidebar.tsx      # 左侧人物栏
│   ├── CharacterBarCard.tsx      # 条形人物卡片
│   ├── CharacterDetail.tsx       # 右侧详情区
│   ├── InfoCard.tsx              # 信息小卡片
│   ├── AliasEditor.tsx           # 别名编辑器
│   ├── RelationshipList.tsx      # 关系列表
│   └── ArtifactList.tsx          # 器物列表
├── services/
│   └── characterApi.ts           # API 客户端
├── stores/
│   └── characterStore.ts         # 状态管理
└── types/
    └── character.ts              # TypeScript 类型
```

---

**后端**
- FastAPI 0.104+
- SQLAlchemy 2.0+
- Pydantic 2.0+
- Alembic (数据库迁移)
- SQLite (开发环境)

**前端（计划）**
- React 18+
- TypeScript 5+
- TanStack Query (React Query)
- Zustand (状态管理)
- Tailwind CSS
- Radix UI (组件库)

