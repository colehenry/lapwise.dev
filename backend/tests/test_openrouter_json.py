from app.services import openrouter_json


class StubResponse:
    def __init__(self, payload: dict):
        self.payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self.payload


def test_generate_openrouter_json_uses_required_contract(monkeypatch):
    captured = {}
    monkeypatch.setattr(openrouter_json.settings, "open_router_api_key", "test-key")

    def fake_post(url, **kwargs):
        captured.update({"url": url, **kwargs})
        return StubResponse(
            {
                "choices": [{"message": {"content": '{"headline":"Race"}'}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 4},
            }
        )

    monkeypatch.setattr(openrouter_json.httpx, "post", fake_post)

    result = openrouter_json.generate_openrouter_json(
        "Return a summary", model="deepseek/deepseek-v4-flash-0731"
    )

    assert result == {"headline": "Race", "tokens_used": 14}
    assert captured["url"] == openrouter_json.OPENROUTER_CHAT_URL
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["json"]["provider"] == {
        "data_collection": "deny",
        "require_parameters": True,
    }
    assert captured["json"]["response_format"] == {"type": "json_object"}


def test_generate_openrouter_json_accepts_fenced_json(monkeypatch):
    monkeypatch.setattr(openrouter_json.settings, "open_router_api_key", "test-key")
    monkeypatch.setattr(
        openrouter_json.httpx,
        "post",
        lambda *_args, **_kwargs: StubResponse(
            {
                "choices": [
                    {"message": {"content": '```json\n{"headline":"Race"}\n```'}}
                ],
                "usage": {"total_tokens": 8},
            }
        ),
    )

    result = openrouter_json.generate_openrouter_json("Return a summary", model="m/x")

    assert result == {"headline": "Race", "tokens_used": 8}


def test_generate_openrouter_json_requires_key(monkeypatch):
    monkeypatch.setattr(openrouter_json.settings, "open_router_api_key", "")

    assert (
        openrouter_json.generate_openrouter_json("Return a summary", model="m/x")
        is None
    )
