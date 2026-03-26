# AIChat 组件设计文档

> LocalScribe AI 写作助手聊天组件 - 完整实现文档

---

## 一、概述

### 1.1 组件定位

AIChat 是 LocalScribe 编辑器页面的右侧辅助面板组件，提供与 AI 对话的交互界面，帮助用户进行写作辅助、文本润色、创意生成等功能。

### 1.2 功能特性

| 特性 | 说明 |
|-----|------|
| 对话交互 | 支持用户与 AI 的多轮对话 |
| 快捷指令 | 预设常用写作辅助快捷按钮 |
| 打字机效果 | 使用 TextTypeLoop 组件展示动态提示语 |
| 自适应输入框 | 输入框高度随内容自动调整 |
| 错误处理 | 支持错误提示和取消请求 |
| 响应式布局 | 适配不同屏幕尺寸 |

---

## 二、UI 设计规范

### 2.1 整体布局

```
┌─────────────────────────────────────┐
│  [模型选择栏] Settings llama2 ✨    │  ← 顶部：模型选择按钮
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │    🤖 AI 写作助手            │   │  ← 空状态：欢迎界面
│  │    [动态打字提示...]         │   │
│  │                             │   │
│  │  ✨ 润色这段文字            │   │  ← 快捷指令按钮
│  │  ⚡ 生成创意灵感            │   │
│  │  💬 分析人物性格            │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  [输入框...]              [发送]    │  ← 底部：输入区域
└─────────────────────────────────────┘
```

### 2.2 消息气泡样式

| 角色 | 背景色 | 文字色 | 圆角 | 对齐 |
|-----|-------|-------|------|-----|
| User | `bg-primary` | `text-primary-foreground` | `rounded-2xl rounded-br-md` | 右侧 |
| Assistant | `bg-card` + border | `text-foreground` | `rounded-2xl rounded-bl-md` | 左侧 |
| System | `bg-destructive/10` | `text-destructive` | `rounded-md` | 左侧 |

### 2.3 颜色系统

```css
/* 主要颜色变量 */
--background: 背景色
--foreground: 前景色
--primary: 主色（用户消息）
--primary-foreground: 主色文字
--accent: 强调色（AI 头像、提示）
--accent-foreground: 强调色文字
--muted: 柔和色
--muted-foreground: 柔和文字
--card: 卡片背景
--border: 边框色
--destructive: 错误色
```

### 2.4 动画效果

| 动画 | 实现方式 | 说明 |
|-----|---------|------|
| 消息进入 | `animate-in fade-in slide-in-from-bottom-3` | 新消息从底部滑入 |
| 快捷指令进入 | `animate-in slide-in-from-bottom-3 fade-in zoom-in-95` | 带延迟的渐入 |
| 输入指示器 | `animate-bounce` | 三个点的弹跳动画 |
| 设置图标旋转 | `group-hover:rotate-45 transition-transform duration-300` | 悬停旋转 45° |
| 按钮缩放 | `hover:scale-105 active:scale-95` | 点击反馈 |

---

## 三、前端实现

### 3.1 文件结构

```
frontend/src/components/AIChat/
├── AIChat.tsx    # 主组件实现
└── index.ts      # 导出文件
```

### 3.2 核心接口定义

```typescript
// Message 消息类型
interface Message {
  id: string;           // 唯一标识
  role: 'user' | 'assistant' | 'system';  // 消息角色
  content: string;      // 消息内容
  timestamp: Date;      // 时间戳
}

// QuickPrompt 快捷指令类型
interface QuickPrompt {
  icon: LucideIcon;     // 图标组件
  text: string;         // 提示文字
  color: string;        // 图标颜色类名
}
```

### 3.3 状态管理

```typescript
const [messages, setMessages] = useState<Message[]>([]);        // 消息列表
const [inputValue, setInputValue] = useState('');               // 输入内容
const [selectedModel] = useState('llama2');                     // 当前模型
const [isTyping, setIsTyping] = useState(false);                // AI 是否正在输入
const [error, setError] = useState<string | null>(null);        // 错误信息
```

### 3.4 核心方法

#### handleSend - 发送消息

```typescript
const handleSend = () => {
  if (!inputValue.trim() || isTyping) return;

  // 1. 清除错误状态
  setError(null);

  // 2. 创建用户消息
  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: inputValue,
    timestamp: new Date(),
  };

  // 3. 更新消息列表
  setMessages((prev) => [...prev, userMessage]);
  setInputValue('');
  setIsTyping(true);

  // 4. 模拟 API 调用（当前为模拟实现）
  timeoutRef.current = setTimeout(async () => {
    try {
      // 模拟网络延迟
      const randomDelay = Math.floor(Math.random() * 1200) + 800;
      await new Promise(resolve => setTimeout(resolve, randomDelay));

      // 模拟响应
      const responses = [...]; // 预设回复数组
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: randomResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiResponse]);
    } catch (err) {
      // 错误处理
    } finally {
      setIsTyping(false);
    }
  }, 100);
};
```

#### handleKeyPress - 键盘事件

```typescript
const handleKeyPress = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};
```

#### handleCancel - 取消请求

```typescript
const handleCancel = () => {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setIsTyping(false);
    
    // 添加取消提示
    const cancelMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content: '请求已取消',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);
  }
};
```

### 3.5 快捷指令配置

```typescript
const quickPrompts = [
  { icon: Wand2, text: '润色这段文字', color: 'text-accent' },
  { icon: Sparkles, text: '生成创意灵感', color: 'text-primary' },
  { icon: MessageSquare, text: '分析人物性格', color: 'text-muted-foreground' },
];
```

### 3.6 依赖组件

| 组件 | 路径 | 用途 |
|-----|------|-----|
| TextTypeLoop | `@/components/TextType` | 动态打字提示效果 |
| Lucide Icons | `lucide-react` | 图标库 |

---

## 四、TextType 组件

### 4.1 功能说明

TextType 组件提供打字机效果的文字展示，支持单文本打字和循环文本打字两种模式。

### 4.2 文件位置

```
frontend/src/components/TextType/TextType.tsx
```

### 4.3 TextType Props

| 属性 | 类型 | 默认值 | 说明 |
|-----|------|-------|------|
| text | string | 必填 | 要打字的文本 |
| className | string | '' | 自定义类名 |
| speed | number | 50 | 打字速度(ms/字符) |
| delay | number | 0 | 开始延迟(ms) |
| cursor | boolean | true | 是否显示光标 |
| cursorChar | string | '\|' | 光标字符 |
| cursorClassName | string | 'animate-pulse' | 光标样式 |
| onComplete | () => void | - | 完成回调 |
| repeat | boolean | false | 是否循环 |
| repeatDelay | number | 2000 | 循环间隔(ms) |
| deleteSpeed | number | 30 | 删除速度(ms/字符) |
| showOnComplete | boolean | true | 完成后是否显示光标 |

### 4.4 TextTypeLoop Props

| 属性 | 类型 | 默认值 | 说明 |
|-----|------|-------|------|
| texts | string[] | 必填 | 文本数组 |
| pauseDuration | number | 1500 | 文本间停顿时间(ms) |

### 4.5 使用示例

```tsx
// AIChat 中的使用
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

---

## 五、后端实现

### 5.1 文件结构

```
backend/app/
├── api/v1/ai.py          # AI API 路由
├── services/ai_service.py # AI 服务实现
└── schemas/ai.py         # 数据模型定义
```

### 5.2 数据模型 (schemas/ai.py)

```python
class AIGenerateRequest(BaseModel):
    prompt: str                      # 用户输入
    model: Optional[str] = None      # 指定模型
    context: Optional[str] = None    # 上下文
    stream: bool = False             # 是否流式输出
    action: Optional[str] = "generate"  # 操作类型

class AIGenerateResponse(BaseModel):
    text: str                        # AI 回复内容

class ModelInfo(BaseModel):
    name: str                        # 模型名称

class ModelListResponse(BaseModel):
    models: List[ModelInfo]          # 模型列表
```

### 5.3 API 路由 (api/v1/ai.py)

```python
@router.post("/generate", response_model=AIGenerateResponse)
async def generate_text(request: AIGenerateRequest):
    """生成文本（非流式）"""
    # 构建完整提示词
    full_prompt = request.prompt
    if request.context:
        full_prompt = f"背景上下文：\n{request.context}\n\n任务：\n{request.prompt}"

    # 调用 AI 服务
    result = await ai_service.generate_text(full_prompt, stream=False)
    return AIGenerateResponse(text=result)

@router.post("/generate/stream")
async def generate_text_stream(request: AIGenerateRequest):
    """生成文本（流式）"""
    full_prompt = request.prompt
    if request.context:
        full_prompt = f"背景上下文：\n{request.context}\n\n任务：\n{request.prompt}"

    generator = await ai_service.generate_text(full_prompt, stream=True)
    return StreamingResponse(generator, media_type="text/event-stream")
```

### 5.4 AI 服务 (services/ai_service.py)

```python
class AIService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL  # Ollama 服务地址
        self.model = settings.OLLAMA_MODEL        # 默认模型
        self.timeout = 60.0                       # 超时时间

    async def generate_text(self, prompt: str, stream: bool = False):
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": stream
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            if stream:
                # 流式响应
                async def stream_generator():
                    async with client.stream("POST", url, json=payload) as response:
                        async for line in response.aiter_lines():
                            if line:
                                data = json.loads(line)
                                if "response" in data:
                                    yield data["response"]
                return stream_generator()
            else:
                # 非流式响应
                response = await client.post(url, json=payload)
                data = response.json()
                return data.get("response", "")

ai_service = AIService()
```

### 5.5 错误处理

| 错误类型 | HTTP 状态码 | 说明 |
|---------|------------|------|
| TimeoutException | 504 | AI 服务响应超时 |
| RequestError | 503 | AI 服务不可用 |
| 其他异常 | 500 | 文本生成失败 |

---

## 六、业务逻辑流程

### 6.1 消息发送流程

```
用户输入
    ↓
验证输入（非空、非正在输入状态）
    ↓
创建用户消息对象 → 添加到消息列表
    ↓
清空输入框、设置 isTyping = true
    ↓
发送 API 请求（当前为模拟）
    ↓
等待响应
    ↓
创建 AI 消息对象 → 添加到消息列表
    ↓
设置 isTyping = false
```

### 6.2 状态流转

```
┌─────────┐    发送消息    ┌─────────┐
│  空闲   │ ────────────▶ │ 等待中  │
│ (idle)  │               │(typing) │
└─────────┘               └────┬────┘
     ▲                         │
     │         收到响应         │
     └─────────────────────────┘
              或取消
```

### 6.3 与后端集成说明

**当前状态**：AIChat 组件目前使用模拟数据，未接入真实后端 API。

**集成建议**：

1. 创建 API 服务文件 `services/aiApi.ts`：

```typescript
import { api } from '@/utils/request';

export interface ChatRequest {
  prompt: string;
  model?: string;
  context?: string;
  stream?: boolean;
}

export interface ChatResponse {
  text: string;
}

export const aiApi = {
  generate: (data: ChatRequest) =>
    api.post<ChatResponse>('/ai/generate', data),
    
  generateStream: (data: ChatRequest) =>
    api.post('/ai/generate/stream', data, {
      responseType: 'stream',
    }),
};
```

2. 修改 `handleSend` 方法调用真实 API：

```typescript
import { aiApi } from '@/services/aiApi';

const handleSend = async () => {
  // ... 前置逻辑
  
  try {
    const response = await aiApi.generate({
      prompt: inputValue,
      model: selectedModel,
      context: noteContent,  // 可传入当前编辑器内容作为上下文
    });
    
    const aiResponse: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: response.text,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, aiResponse]);
  } catch (err) {
    // 错误处理
  } finally {
    setIsTyping(false);
  }
};
```

---

## 七、使用方式

### 7.1 在 EditorPage 中使用

```tsx
// EditorPage.tsx
import { AIChat } from '@/components/AIChat';

export const EditorPage = () => {
  // ...
  
  return (
    <div className="flex h-full">
      {/* 左侧编辑器 */}
      <div className="flex-1">
        <Editor />
      </div>
      
      {/* 右侧 AIChat */}
      <div style={{ width: `${rightPanelWidth}%` }}>
        <AIChat />
      </div>
    </div>
  );
};
```

### 7.2 独立使用

```tsx
import { AIChat } from '@/components/AIChat';

function App() {
  return (
    <div className="h-[600px] w-[400px]">
      <AIChat />
    </div>
  );
}
```

---

## 八、扩展建议

### 8.1 功能扩展

| 功能 | 说明 | 优先级 |
|-----|------|-------|
| 历史记录 | 持久化保存对话历史 | 高 |
| 多模型切换 | 支持切换不同 AI 模型 | 高 |
| 流式输出 | 支持打字机式流式响应 | 中 |
| 文件上传 | 支持上传文档作为上下文 | 中 |
| 提示词模板 | 预设更多写作场景模板 | 中 |
| 导出对话 | 支持导出对话记录 | 低 |

### 8.2 性能优化

1. **虚拟列表**：消息过多时使用虚拟滚动
2. **防抖输入**：输入框添加防抖处理
3. **消息分页**：历史消息分页加载
4. **缓存策略**：缓存常用提示词响应

---

## 九、相关文件索引

| 文件 | 路径 | 说明 |
|-----|------|-----|
| AIChat.tsx | `frontend/src/components/AIChat/AIChat.tsx` | 主组件 |
| index.ts | `frontend/src/components/AIChat/index.ts` | 导出文件 |
| TextType.tsx | `frontend/src/components/TextType/TextType.tsx` | 打字机组件 |
| ai.py | `backend/app/api/v1/ai.py` | 后端 API |
| ai_service.py | `backend/app/services/ai_service.py` | AI 服务 |
| ai.py (schemas) | `backend/app/schemas/ai.py` | 数据模型 |
| EditorPage.tsx | `frontend/src/pages/EditorPage/EditorPage.tsx` | 使用页面 |

---

*文档版本: 1.0*
*最后更新: 2025-03-25*
