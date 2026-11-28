from starlette.responses import JSONResponse


class RequestSizeLimit:
    """Bound POST bodies before JSON parsing, including chunked requests."""

    def __init__(self, app, maximum=16384):
        self.app = app
        self.maximum = maximum

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST":
            await self.app(scope, receive, send)
            return
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            incoming = message.get("body", b"")
            if len(body) + len(incoming) > self.maximum:
                from datetime import UTC, datetime

                response = JSONResponse(
                    {
                        "code": "REQUEST_TOO_LARGE",
                        "message": "Request exceeds the size limit.",
                        "timestamp": datetime.now(UTC).isoformat(),
                    },
                    status_code=413,
                )
                await response(scope, receive, send)
                return
            body.extend(incoming)
            if not message.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
