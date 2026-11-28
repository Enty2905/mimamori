import asyncio
import json
import logging
from typing import List, Optional
import httpx
from config import build_headers, build_cookies
from session import get_or_create_session
from pow_solver import get_pow_token

log = logging.getLogger("deepseek")


class DeepSeekAuthError(RuntimeError):
    """Raised when DeepSeek auth token or cookies are missing/expired (401/403)."""


class DeepSeekUpstreamError(RuntimeError):
    """Raised when DeepSeek upstream fails or returns an invalid/empty response."""


async def upload_file(
    client: httpx.AsyncClient,
    cfg: dict,
    file_bytes: bytes,
    filename: str,
    mime_type: str,
) -> str:
    """Upload an image file to DeepSeek Web and return its file_id."""
    pow_token = await get_pow_token(client, cfg, target_path="/api/v0/file/upload_file")
    headers = {
        k: v
        for k, v in build_headers(cfg, pow_token).items()
        if k.lower() != "content-type"
    }
    cookies = build_cookies(cfg)

    url = "https://chat.deepseek.com/api/v0/file/upload_file"
    files = {"file": (filename, file_bytes, mime_type)}
    resp = await client.post(url, files=files, headers=headers, cookies=cookies, timeout=60.0)
    if resp.status_code in (401, 403):
        raise DeepSeekAuthError(
            f"Auth token hoặc cookies đã hết hạn khi tải ảnh lên (HTTP {resp.status_code})! Vui lòng cập nhật config.json"
        )
    resp.raise_for_status()

    data = resp.json()
    code = data.get("code")
    if code not in (None, 0):
        raise DeepSeekUpstreamError(f"DeepSeek upload_file lỗi (code={code}): {data.get('msg') or data}")

    biz_data = data.get("data", {}).get("biz_data", {})
    file_id = biz_data.get("id") if isinstance(biz_data, dict) else None
    if not file_id:
        raise DeepSeekUpstreamError(f"DeepSeek upload_file không trả về file_id: {data}")
    return str(file_id)


async def wait_for_file_parsed(
    client: httpx.AsyncClient,
    cfg: dict,
    file_id: str,
    timeout_seconds: float = 25.0,
) -> None:
    """Poll DeepSeek fetch_files until the uploaded file finishes parsing."""
    url = "https://chat.deepseek.com/api/v0/file/fetch_files"
    headers = build_headers(cfg)
    cookies = build_cookies(cfg)
    deadline = asyncio.get_running_loop().time() + timeout_seconds

    while True:
        resp = await client.get(
            url,
            params={"file_ids": file_id},
            headers=headers,
            cookies=cookies,
            timeout=20.0,
        )
        if resp.status_code in (401, 403):
            raise DeepSeekAuthError(
                f"Auth token hoặc cookies đã hết hạn khi kiểm tra ảnh (HTTP {resp.status_code})!"
            )
        resp.raise_for_status()

        data = resp.json()
        code = data.get("code")
        if code not in (None, 0):
            raise DeepSeekUpstreamError(f"DeepSeek fetch_files lỗi (code={code}): {data.get('msg') or data}")

        biz_data = data.get("data", {}).get("biz_data")
        records = []
        if isinstance(biz_data, dict):
            if isinstance(biz_data.get("files"), list):
                records = biz_data["files"]
            elif "status" in biz_data:
                records = [biz_data]
        elif isinstance(biz_data, list):
            records = biz_data

        status = ""
        if records and isinstance(records[0], dict):
            status = str(records[0].get("status") or "").upper()

        if status == "SUCCESS":
            return
        if status in ("FAILED", "FAIL", "ERROR"):
            raise DeepSeekUpstreamError(f"DeepSeek không thể xử lý tệp ảnh (status={status}).")

        if asyncio.get_running_loop().time() >= deadline:
            raise DeepSeekUpstreamError(f"Hết thời gian chờ DeepSeek xử lý ảnh (status={status or 'UNKNOWN'}).")

        await asyncio.sleep(0.6)


async def chat_completion(
    client: httpx.AsyncClient,
    cfg: dict,
    prompt: str,
    thinking_enabled: bool = True,
    force_new_session: bool = False,
    max_retries: int = 3,
    ref_file_ids: Optional[List[str]] = None,
) -> str:
    """Gửi câu hỏi tới DeepSeek Web và bóc tách câu trả lời từ luồng SSE."""
    try:
        session_id = await get_or_create_session(client, cfg, force_new=force_new_session)
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (401, 403):
            raise DeepSeekAuthError(
                f"Auth token hoặc cookies đã hết hạn khi tạo session (HTTP {e.response.status_code})! Vui lòng cập nhật config.json"
            ) from e
        raise DeepSeekUpstreamError(
            f"Không thể tạo phiên chat DeepSeek (HTTP {e.response.status_code})"
        ) from e

    for attempt in range(max_retries):
        try:
            pow_token = await get_pow_token(client, cfg)
            headers = build_headers(cfg, pow_token)
            cookies = build_cookies(cfg)

            payload = {
                "chat_session_id": session_id,
                "parent_message_id": None,
                "prompt": prompt,
                "ref_file_ids": list(ref_file_ids) if ref_file_ids else [],
                "thinking_enabled": thinking_enabled,
                "search_enabled": False,
            }

            url = "https://chat.deepseek.com/api/v0/chat/completion"
            async with client.stream(
                "POST",
                url,
                json=payload,
                headers=headers,
                cookies=cookies,
                timeout=120.0,
            ) as resp:
                if resp.status_code in (401, 403):
                    await resp.aread()
                    raise DeepSeekAuthError(
                        f"Auth token hoặc cookies đã hết hạn (HTTP {resp.status_code})! Vui lòng cập nhật config.json"
                    )

                if resp.status_code in (429, 503):
                    body_preview = (await resp.aread()).decode(errors="ignore")[:200]
                    wait = 2 ** attempt + 1
                    log.warning(
                        f"DeepSeek bị giới hạn / bận (HTTP {resp.status_code}: {body_preview}) – thử lại sau {wait}s..."
                    )
                    if attempt == max_retries - 1:
                        raise DeepSeekUpstreamError(
                            f"DeepSeek đang bận hoặc bị giới hạn tốc độ (HTTP {resp.status_code})."
                        )
                    await asyncio.sleep(wait)
                    session_id = await get_or_create_session(client, cfg, force_new=True)
                    continue

                if resp.status_code in (400, 404, 410):
                    body_preview = (await resp.aread()).decode(errors="ignore")[:200]
                    log.warning(
                        f"Session {session_id} không hợp lệ (HTTP {resp.status_code}: {body_preview}), tạo phiên mới..."
                    )
                    if attempt == max_retries - 1:
                        raise DeepSeekUpstreamError(
                            f"DeepSeek từ chối phiên chat (HTTP {resp.status_code}): {body_preview}"
                        )
                    session_id = await get_or_create_session(client, cfg, force_new=True)
                    await asyncio.sleep(1.0)
                    continue

                resp.raise_for_status()

                content_type = resp.headers.get("content-type", "").lower()
                if "application/json" in content_type:
                    raw_body = (await resp.aread()).decode(errors="ignore")
                    try:
                        err_json = json.loads(raw_body)
                    except json.JSONDecodeError:
                        err_json = {}
                    err_msg = str(err_json.get("msg") or err_json.get("message") or raw_body[:200])
                    err_code = err_json.get("code")
                    if "busy" in err_msg.lower() and attempt < max_retries - 1:
                        wait = 2 ** attempt + 1
                        log.warning(f"DeepSeek báo bận ({err_msg}) – thử lại sau {wait}s...")
                        await asyncio.sleep(wait)
                        session_id = await get_or_create_session(client, cfg, force_new=True)
                        continue
                    raise DeepSeekUpstreamError(
                        f"DeepSeek trả về JSON thay vì luồng SSE (code={err_code}): {err_msg}"
                    )

                full_response = []
                is_in_response = False

                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        msg = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    if isinstance(msg, dict) and msg.get("code") not in (None, 0):
                        err_msg = msg.get("msg") or msg.get("message") or str(msg)
                        raise DeepSeekUpstreamError(
                            f"DeepSeek SSE error (code={msg.get('code')}): {err_msg}"
                        )

                    # Khởi tạo khối RESPONSE
                    if "v" in msg and isinstance(msg["v"], dict) and "response" in msg["v"]:
                        fragments = msg["v"]["response"].get("fragments", [])
                        for f in fragments:
                            if f.get("type") == "RESPONSE":
                                is_in_response = True
                                if f.get("content"):
                                    full_response.append(f["content"])
                        continue

                    # Chuyển đổi trạng thái từ THINK sang RESPONSE
                    if msg.get("p") == "response/fragments" and isinstance(msg.get("v"), list):
                        for f in msg.get("v", []):
                            if isinstance(f, dict) and f.get("type") == "RESPONSE":
                                is_in_response = True
                                if f.get("content"):
                                    full_response.append(f["content"])
                        continue

                    # Thu thập text delta trong khối RESPONSE
                    if is_in_response and "v" in msg and isinstance(msg["v"], str):
                        path = msg.get("p")
                        if msg.get("o") == "SET" or (
                            isinstance(path, str) and (path == "response/status" or path.endswith("/status"))
                        ):
                            continue
                        full_response.append(msg["v"])

                result_text = "".join(full_response).strip()
                if result_text:
                    return result_text

                # Nếu chưa nhận được kết quả (có thể do session bận), tạo session mới và retry
                log.warning(f"Chưa nhận được phản hồi (lần {attempt + 1}/{max_retries}), đang thử lại...")
                if attempt < max_retries - 1:
                    session_id = await get_or_create_session(client, cfg, force_new=True)
                    await asyncio.sleep(2.0)

        except DeepSeekAuthError:
            raise
        except httpx.HTTPStatusError as e:
            log.error(f"HTTP error {e.response.status_code}: {e}")
            if e.response.status_code in (401, 403):
                raise DeepSeekAuthError(
                    f"Auth token hoặc cookies đã hết hạn (HTTP {e.response.status_code})! Vui lòng cập nhật config.json"
                ) from e
            if attempt == max_retries - 1:
                raise
            if e.response.status_code in (400, 404, 410):
                session_id = await get_or_create_session(client, cfg, force_new=True)
            await asyncio.sleep(2 ** attempt)
        except Exception as e:
            log.exception(f"Lỗi gửi câu hỏi: {e}")
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)

    raise DeepSeekUpstreamError("Không thể nhận câu trả lời sau số lần thử tối đa.")
