# backend/app/services/ai_service.py
import httpx
from app.core.config import settings
from typing import AsyncGenerator, Optional

class AIService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL
        self.timeout = 60.0 # Ollama 生成可能较慢，设置长超时

    async def generate_text(self, prompt: str, stream: bool = False) -> AsyncGenerator[str, None] | str:
        """
        调用 Ollama API 生成文本
        """
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": stream
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            if stream:
                # 流式响应处理
                async def stream_generator():
                    async with client.stream("POST", url, json=payload) as response:
                        async for line in response.aiter_lines():
                            # Ollama 返回的是 NDJSON 格式
                            if line:
                                try:
                                    import json
                                    data = json.loads(line)
                                    if "response" in data:
                                        yield data["response"]
                                except json.JSONDecodeError:
                                    continue
                return stream_generator()
            else:
                # 非流式响应处理
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    return data.get("response", "")
                else:
                    raise Exception(f"Ollama error: {response.text}")

# 实例化服务
ai_service = AIService()
