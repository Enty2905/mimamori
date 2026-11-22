#!/usr/bin/env python3
"""
DeepSeek Web Proxy Server (FastAPI)
Cung cấp API HTTP cục bộ phục vụ các ứng dụng khác gọi DeepSeek.
"""
import asyncio
import base64
import binascii
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import load_config
from client import (
    DeepSeekAuthError,
    DeepSeekUpstreamError,
    chat_completion,
    upload_file,
    wait_for_file_parsed,
)

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


MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_IMAGE_MIMES = {
    "image/jpeg": "medicine.jpg",
    "image/jpg": "medicine.jpg",
    "image/png": "medicine.png",
    "image/webp": "medicine.webp",
    "image/gif": "medicine.gif",
    "image/heic": "medicine.heic",
    "image/heif": "medicine.heif",
}
_DATA_URI_RE = re.compile(r"^data:([^;]+);base64,(.*)$", re.IGNORECASE | re.DOTALL)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Nội dung câu hỏi")
    system_prompt: Optional[str] = Field(None, description="Prompt hệ thống (tùy chọn)")
    history: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Lịch sử hội thoại tùy chọn dạng [{role, content}, ...]",
    )
    thinking_enabled: bool = Field(True, description="Bật chế độ suy luận DeepSeek-R1")
    new_chat: bool = Field(False, description="Tạo một đoạn chat mới riêng biệt")
    image_base64: Optional[str] = Field(None, description="Ảnh đính kèm dạng base64 (tùy chọn)")
    image_mime_type: Optional[str] = Field(None, description="MIME type của ảnh (mặc định image/jpeg)")


class ChatResponse(BaseModel):
    response: str


def _decode_image_payload(raw_base64: str, raw_mime: Optional[str]) -> Tuple[bytes, str, str]:
    cleaned = raw_base64.strip()
    mime = (raw_mime or "").strip().lower()

    match = _DATA_URI_RE.match(cleaned)
    if match:
        if not mime:
            mime = match.group(1).strip().lower()
        cleaned = match.group(2)

    if not mime:
        mime = "image/jpeg"
    if mime == "image/jpg":
        mime = "image/jpeg"
    if mime not in ALLOWED_IMAGE_MIMES:
        raise HTTPException(status_code=400, detail=f"Unsupported image_mime_type: {mime}")

    cleaned = re.sub(r"\s+", "", cleaned)
    try:
        image_bytes = base64.b64decode(cleaned, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image_base64: {exc}")

    if not image_bytes:
        raise HTTPException(status_code=400, detail="image_base64 decoded to empty bytes")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 10MB limit")

    return image_bytes, mime, ALLOWED_IMAGE_MIMES[mime]


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


async def _handle_chat(req: ChatRequest) -> ChatResponse:
    if not req.message.strip():
        raise HTTPException(status_code=422, detail="message must not be blank")

    image_payload: Optional[Tuple[bytes, str, str]] = None
    if req.image_base64 and req.image_base64.strip():
        image_payload = _decode_image_payload(req.image_base64, req.image_mime_type)

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
                ref_file_ids: List[str] = []
                if image_payload is not None:
                    image_bytes, mime_type, filename = image_payload
                    file_id = await upload_file(client, cfg, image_bytes, filename, mime_type)
                    await wait_for_file_parsed(client, cfg, file_id)
                    ref_file_ids = [file_id]

                answer = await chat_completion(
                    client=client,
                    cfg=cfg,
                    prompt=prompt,
                    thinking_enabled=req.thinking_enabled,
                    force_new_session=req.new_chat,
                    ref_file_ids=ref_file_ids,
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


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    return await _handle_chat(req)


@app.post("/chat-vision", response_model=ChatResponse)
async def chat_vision_endpoint(req: ChatRequest):
    if not req.image_base64 or not req.image_base64.strip():
        raise HTTPException(status_code=400, detail="image_base64 is required for /chat-vision")
    return await _handle_chat(req)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "deepseek-proxy"}


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8001"))
    print(f"[*] Khởi động DeepSeek API Proxy Server trên http://{host}:{port} ...")
    uvicorn.run("main:app", host=host, port=port, reload=False)
