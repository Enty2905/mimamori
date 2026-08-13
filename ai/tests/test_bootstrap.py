from src.api.main import app


def test_application_is_initialized() -> None:
    assert app.title == "Mimamori AI Service"
