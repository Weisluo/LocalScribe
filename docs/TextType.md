# TextType 组件文档

## 概述

TextType 是一个 React 打字机效果组件，用于在 UI 中实现逐字显示的打字机动画效果。该组件支持多种配置选项，包括打字速度、光标显示、循环播放等功能。

## 组件结构

```
frontend/src/components/TextType/
├── TextType.tsx    # 主组件实现
└── index.ts        # 导出文件
```

## 前端实现

### 1. TextType 组件

基础打字机效果组件，支持单向打字和删除回退效果。

#### Props 接口

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `text` | `string` | 必填 | 要显示的完整文本 |
| `className` | `string` | `''` | 自定义 CSS 类名 |
| `speed` | `number` | `50` | 打字速度（毫秒/字符） |
| `delay` | `number` | `0` | 开始打字前的延迟时间（毫秒） |
| `cursor` | `boolean` | `true` | 是否显示光标 |
| `cursorChar` | `string` | `'\|'` | 光标字符 |
| `cursorClassName` | `string` | `'animate-pulse'` | 光标的 CSS 类名 |
| `onComplete` | `() => void` | `undefined` | 打字完成时的回调函数 |
| `repeat` | `boolean` | `false` | 是否循环播放（打字→删除→重新打字） |
| `repeatDelay` | `number` | `2000` | 循环播放前的停顿时间（毫秒） |
| `deleteSpeed` | `number` | `30` | 删除速度（毫秒/字符） |
| `showOnComplete` | `boolean` | `true` | 完成后是否继续显示光标 |

#### 核心状态

```typescript
const [displayText, setDisplayText] = useState('');      // 当前显示的文本
const [currentIndex, setCurrentIndex] = useState(0);     // 当前字符索引
const [isDeleting, setIsDeleting] = useState(false);     // 是否处于删除模式
const [isComplete, setIsComplete] = useState(false);     // 是否完成
const [showCursor, setShowCursor] = useState(cursor);    // 是否显示光标
```

#### 打字逻辑

1. **打字阶段**：逐字符增加 `displayText`，直到完整显示 `text`
2. **删除阶段**：逐字符删除 `displayText`，直到为空
3. **随机延迟**：添加 ±10ms 的随机性使打字效果更自然
4. **循环逻辑**：完成 → 停顿 → 删除 → 重新打字

### 2. TextTypeLoop 组件

多文本循环打字组件，用于在多个文本之间循环切换。

#### Props 接口

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `texts` | `string[]` | 必填 | 要循环显示的文本数组 |
| `pauseDuration` | `number` | `1500` | 每条文本显示后的停顿时间（毫秒） |
| 其他属性 | - | - | 继承自 TextType（除 `text`、`repeat`、`onComplete`） |

#### 工作原理

1. 使用 `currentTextIndex` 跟踪当前显示的文本索引
2. 使用 `key` 强制重新渲染 TextType 组件
3. 每条文本完成后，停顿 `pauseDuration` 时间
4. 切换到下一个文本，循环往复

## 使用示例

### 基础用法

```tsx
import { TextType } from '@/components/TextType';

// 基础打字效果
<TextType text="Hello World" speed={50} />

// 带延迟和回调
<TextType 
  text="加载完成" 
  delay={1000} 
  onComplete={() => console.log('完成')}
/>

// 循环播放
<TextType 
  text="循环文本" 
  repeat={true} 
  repeatDelay={2000}
  deleteSpeed={30}
/>
```

### 循环多文本

```tsx
import { TextTypeLoop } from '@/components/TextType';

<TextTypeLoop
  texts={[
    '第一条消息',
    '第二条消息',
    '第三条消息'
  ]}
  speed={60}
  deleteSpeed={40}
  pauseDuration={2000}
  cursorChar="|"
  cursorClassName="text-accent animate-pulse"
/>
```

## 应用场景

### 1. AI 聊天界面（AIChat.tsx）

用于显示 AI 助手的功能提示语：

```tsx
<TextTypeLoop
  texts={[
    '让 AI 辅助你的创作...',
    '润色文字，让表达更流畅',
    '生成创意灵感，突破瓶颈',
    '分析人物性格，深化角色',
  ]}
  speed={60}
  deleteSpeed={40}
  pauseDuration={2000}
  cursorChar="|"
  cursorClassName="text-accent animate-pulse"
/>
```

**UI 效果**：
- 在聊天界面空白状态时显示
- 使用强调色（accent）的光标
- 循环展示 AI 助手的各项功能

### 2. 编辑器加载状态（Editor.tsx）

用于编辑器初始化时的加载提示：

```tsx
<TextTypeLoop
  texts={[
    '正在准备创作环境...',
    '灵感即将涌现...',
    '故事等待被书写...',
  ]}
  speed={50}
  deleteSpeed={35}
  pauseDuration={1500}
  cursorChar="|"
  cursorClassName="text-accent animate-pulse"
/>
```

### 3. 编辑器占位符

用于编辑器内容为空时的占位提示：

```tsx
<TextTypeLoop
  texts={[
    '开始书写你的故事，让文字流淌...',
    '每一个伟大的故事都始于第一句话...',
    '记录下此刻的灵感，它可能改变一切...',
    '文字是思想的载体，开始创作吧...',
  ]}
  speed={50}
  deleteSpeed={35}
  pauseDuration={1500}
  cursorChar="|"
  cursorClassName="text-muted-foreground/50"
/>
```

## UI 效果规范

### 视觉样式

1. **光标样式**
   - 默认使用 `animate-pulse` 动画实现闪烁效果
   - 支持自定义光标字符（默认为 `|`）
   - 支持自定义光标颜色（通过 `cursorClassName`）

2. **文本样式**
   - 通过 `className` 完全自定义文本样式
   - 组件返回 `<span>` 元素，可内联使用

3. **颜色方案**
   - AI 聊天界面：使用 `text-accent` 强调色
   - 编辑器占位符：使用 `text-muted-foreground/50` 弱化显示
   - 加载状态：使用 `text-accent animate-pulse`

### 动画参数

| 场景 | 打字速度 | 删除速度 | 停顿时间 | 光标样式 |
|------|----------|----------|----------|----------|
| AI 聊天提示 | 60ms | 40ms | 2000ms | 强调色+脉冲 |
| 编辑器加载 | 50ms | 35ms | 1500ms | 强调色+脉冲 |
| 编辑器占位符 | 50ms | 35ms | 1500ms | 弱化灰色 |

## 业务逻辑

### 状态流转

```
初始状态
    ↓ (delay 延迟)
开始打字
    ↓ (逐字符显示)
打字完成
    ├── onComplete 回调
    ├── 不循环：光标隐藏（可选）
    └── 循环：等待 repeatDelay
                ↓
            开始删除
                ↓ (逐字符删除)
            删除完成
                ↓
            重新开始打字
```

### 性能优化

1. **随机延迟**：添加 ±10ms 随机性避免动画过于机械
2. **useCallback**：`typeNextChar` 使用 `useCallback` 缓存
3. **清理机制**：组件卸载时清除所有 timeout
4. **最小延迟**：确保延迟不低于 10ms，避免过快渲染

## 技术细节

### 依赖

- React 18+
- TypeScript
- Tailwind CSS（用于样式类名）

### 无后端依赖

TextType 是一个纯前端展示组件，不涉及任何后端 API 调用或数据处理。

## 扩展建议

### 可能的增强功能

1. **声音效果**：添加打字机音效
2. **错误模拟**：模拟打字错误和退格修正
3. **富文本支持**：支持 Markdown 或 HTML 内容的打字效果
4. **速度曲线**：支持自定义打字速度曲线（如先快后慢）
5. **光标样式**：支持更多光标样式（下划线、块等）

### 注意事项

1. **性能**：大量 TextType 组件同时渲染可能影响性能
2. **可访问性**：考虑为屏幕阅读器提供替代文本
3. **移动端**：确保动画在移动设备上流畅运行
