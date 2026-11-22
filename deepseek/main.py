#!/usr/bin/env python3
"""
DeepSeek Web Proxy Server (FastAPI)
Cung cấp API HTTP cục bộ phục vụ các ứng dụng khác gọi DeepSeek.
"""
import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional
import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import load_config
from client import DeepSeekAuthError, DeepSeekUpstreamError, chat_completion

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("deepseek")

CONNECT_TIMEOUT = float(os.getenv("DEEPSEEK_CONNECT_TIMEOUT", "10.0"))
READ_TIMEOUT = float(os.getenv("DEEPSEEK_READ_TIMEOUT", "90.0"))

# Serialize DeepSeek Web chat_session_id usage & config.json updates across concurrent requests
_chat_lock = asyncio.Lock()

app = FastAPI(title="DeepSeek Web Proxy", version="2.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Nội dung câu hỏi")
    system_prompt: Optional[str] = Field(None, description="Prompt hệ thống (tùy chọn)")
    history: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Lịch sử hội thoại tùy chọn dạng [{role, content}, ...]",
    )
    thinking_enabled: bool = Field(True, description="Bật chế độ suy luận DeepSeek-R1")
    new_chat: bool = Field(False, description="Tạo một đoạn chat mới riêng biệt")


class ChatResponse(BaseModel):
    response: str


def _build_prompt(req: ChatRequest) -> str:
    """Assemble system_prompt, optional structured history, and user message."""
    parts: List[str] = []
    if req.system_prompt and req.system_prompt.strip():
        parts.append(req.system_prompt.strip())

    if req.history:
        history_lines: List[str] = []
        for turn in req.history:
            if not isinstance(turn, dict):
                continue
            content = str(turn.get("content") or turn.get("text") or "").strip()
            if not content:
                continue
            role = str(turn.get("role") or "user").strip().lower()
            if role == "user":
                label = "Người dùng"
            elif role in ("assistant", "model", "bot"):
                label = "Trợ lý"
            else:
                label = role
            history_lines.append(f"{label}: {content}")
        if history_lines:
            parts.append("Lịch sử hội thoại gần đây:\n" + "\n".join(history_lines))

    parts.append(req.message)
    return "\n\n".join(parts)


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=422, detail="message must not be blank")

    prompt = _build_prompt(req)
    timeout = httpx.Timeout(timeout=READ_TIMEOUT, connect=CONNECT_TIMEOUT)

    try:
        async with _chat_lock:
            cfg = load_config()
            if not cfg.get("auth_token"):
                raise HTTPException(
                    status_code=503,
                    detail="DeepSeek auth_token is missing in config.json",
                )

            async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
                answer = await chat_completion(
                    client=client,
                    cfg=cfg,
                    prompt=prompt,
                    thinking_enabled=req.thinking_enabled,
                    force_new_session=req.new_chat,
                )
        return ChatResponse(response=answer)
    except HTTPException:
        raise
    except (FileNotFoundError, json.JSONDecodeError) as e:
        log.error(f"Lỗi cấu hình DeepSeek proxy: {e}")
        raise HTTPException(status_code=503, detail=f"DeepSeek proxy config error: {e}")
    except DeepSeekAuthError as e:
        log.error(f"DeepSeek auth/cookies hết hạn: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except httpx.TimeoutException as e:
        log.error(f"DeepSeek upstream timeout: {e}")
        raise HTTPException(status_code=503, detail=f"DeepSeek upstream timeout: {e}")
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        log.error(f"DeepSeek upstream HTTP {code}: {e}")
        if code in (401, 403):
            raise HTTPException(
                status_code=503,
                detail=f"DeepSeek auth token or cookies expired (HTTP {code}); update config.json",
            )
        if code in (429, 503):
            raise HTTPException(
                status_code=503,
                detail=f"DeepSeek upstream rate-limited or unavailable (HTTP {code})",
            )
        raise HTTPException(status_code=502, detail=f"DeepSeek upstream HTTP {code}: {e}")
    except httpx.RequestError as e:
        log.error(f"DeepSeek upstream network error: {e}")
        raise HTTPException(status_code=502, detail=f"DeepSeek upstream network error: {e}")
    except (DeepSeekUpstreamError, RuntimeError) as e:
        log.error(f"Lỗi upstream /chat: {e}")
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        log.exception(f"Lỗi không mong muốn ở endpoint /chat: {e}")
        raise HTTPException(status_code=502, detail=f"DeepSeek proxy error: {e}")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "deepseek-proxy"}


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8001"))
    print(f"[*] Khởi động DeepSeek API Proxy Server trên http://{host}:{port} ...")
    uvicorn.run("main:app", host=host, port=port, reload=False)
