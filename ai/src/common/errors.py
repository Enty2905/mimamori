class IngestionError(Exception):
    """Only this safe code/message pair crosses the operator/API boundary."""

    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(code)
