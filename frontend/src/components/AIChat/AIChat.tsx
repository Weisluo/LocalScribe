import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Settings, Sparkles, MessageSquare, Wand2, X, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export const AIChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel] = useState('llama2');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 自动调整输入框高度
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  // 清理函数：取消任何未完成的 timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) return;

    // 清除之前的错误
    setError(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // 取消之前的任何未完成的请求
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // 模拟 API 调用
    timeoutRef.current = setTimeout(async () => {
      try {
        // 模拟 API 延迟 - 随机 800-2000ms 来模拟真实网络情况
        const randomDelay = Math.floor(Math.random() * 1200) + 800;
        
        // 模拟网络请求
        await new Promise(resolve => setTimeout(resolve, randomDelay));

        // 模拟不同的响应
        const responses = [
          '这是一个模拟回复。请在此接入 Ollama API。',
          '我是你的写作助手，可以帮你润色文字、生成创意灵感或分析人物性格。',
          '根据你的需求，我可以提供更多写作建议和创意支持。',
          '写作是一个创造性的过程，让我们一起探索更多可能性。'
        ];
        
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
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'system',
          content: '抱歉，AI 服务暂时不可用，请稍后再试。',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setError('AI 服务出错，请稍后再试');
      } finally {
        setIsTyping(false);
        timeoutRef.current = null;
      }
    }, 100); // 初始延迟很小，主要的延迟在模拟 API 调用中
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCancel = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setIsTyping(false);
      
      const cancelMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: '请求已取消',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, cancelMessage]);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const quickPrompts = [
    { icon: Wand2, text: '润色这段文字', color: 'text-accent' },
    { icon: Sparkles, text: '生成创意灵感', color: 'text-primary' },
    { icon: MessageSquare, text: '分析人物性格', color: 'text-muted-foreground' },
  ];

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
      {/* 模型选择栏 */}
      <div className="p-3 border-b border-border/60 flex-shrink-0 bg-card/50 backdrop-blur-sm">
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/15 hover:bg-accent/25 transition-all duration-200 text-sm w-full justify-center group border border-accent/20">
          <Settings className="h-4 w-4 text-accent group-hover:rotate-45 transition-transform duration-300" />
          <span className="font-medium text-accent-foreground">{selectedModel}</span>
          <Sparkles className="h-3 w-3 text-accent/60" />
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 border-b border-border/60 flex items-center justify-between bg-destructive/10">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-destructive/20 rounded transition-colors"
          >
            <X className="h-4 w-4 text-destructive" />
          </button>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full" />
              <Bot className="h-16 w-16 relative opacity-40" />
            </div>
            <p className="text-sm font-medium mb-2">AI 写作助手</p>
            <p className="text-xs opacity-60 mb-6 text-center max-w-[200px]">
              选择下方快捷指令或输入问题，让 AI 辅助你的创作
            </p>
            
            {/* 快捷指令 */}
            <div className="flex flex-col gap-2 w-full max-w-[240px]">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputValue(prompt.text)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-card hover:bg-accent/10 border border-border/50 hover:border-accent/30 transition-all duration-200 text-left group"
                >
                  <prompt.icon className={`h-4 w-4 ${prompt.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-sm text-foreground/80">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div
                key={msg.id}
                className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* 头像 */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : msg.role === 'assistant'
                      ? 'bg-accent/20 text-accent'
                      : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : msg.role === 'assistant' ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                </div>
                
                {/* 消息内容 */}
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[75%]`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : msg.role === 'assistant'
                        ? 'bg-card border border-border/50 rounded-bl-md'
                        : 'bg-destructive/10 border border-destructive/20 rounded-md text-destructive'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1.5 opacity-60">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            ))}
            
            {/* 正在输入指示器 */}
            {isTyping && (
              <div className="flex gap-3 animate-in fade-in duration-300">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-accent/20 text-accent">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 px-4 py-3 bg-card border border-border/50 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <button
                    onClick={handleCancel}
                    className="ml-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="p-3 border-t border-border/60 flex-shrink-0 bg-card/50 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="输入消息..."
              rows={1}
              className="w-full px-4 py-2.5 pr-10 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring resize-none min-h-[42px] max-h-[120px] transition-all duration-200"
            />
            {inputValue && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50">
                ↵
              </span>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className="flex-shrink-0 p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
