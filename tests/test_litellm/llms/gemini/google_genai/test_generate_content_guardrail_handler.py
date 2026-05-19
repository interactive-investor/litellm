import os
import sys
from typing import Any, Literal, Optional

import pytest

sys.path.insert(0, os.path.abspath("../../../../../../.."))

from litellm.llms import get_guardrail_translation_mapping
from litellm.llms.gemini.google_genai.guardrail_translation.handler import (
    GoogleGenAIGenerateContentHandler,
)
from litellm.proxy.guardrails.guardrail_hooks.presidio import (
    _OPTIONAL_PresidioPIIMasking,
)
from litellm.types.google_genai.main import GenerateContentResponse
from litellm.types.utils import CallTypes, GenericGuardrailAPIInputs


class RecordingGuardrail(_OPTIONAL_PresidioPIIMasking):
    def __init__(self) -> None:
        super().__init__(
            mock_testing=True,
            presidio_skip_system_developer_message=True,
        )
        self.last_inputs: Optional[GenericGuardrailAPIInputs] = None

    async def apply_guardrail(
        self,
        inputs: GenericGuardrailAPIInputs,
        request_data: dict,
        input_type: Literal["request", "response"],
        logging_obj: Optional[Any] = None,
    ) -> GenericGuardrailAPIInputs:
        self.last_inputs = inputs
        return inputs


class UppercaseGuardrail:
    guardrail_name = "uppercase"

    async def apply_guardrail(
        self,
        inputs: GenericGuardrailAPIInputs,
        request_data: dict,
        input_type: Literal["request", "response"],
        logging_obj: Optional[Any] = None,
    ) -> GenericGuardrailAPIInputs:
        return {
            "texts": [text.upper() for text in inputs.get("texts", [])],
        }


class TestHandlerDiscovery:
    def test_handler_discovered_for_generate_content(self):
        handler_class = get_guardrail_translation_mapping(CallTypes.generate_content)
        assert handler_class == GoogleGenAIGenerateContentHandler

    def test_handler_discovered_for_agenerate_content(self):
        handler_class = get_guardrail_translation_mapping(CallTypes.agenerate_content)
        assert handler_class == GoogleGenAIGenerateContentHandler

    def test_handler_discovered_for_generate_content_stream(self):
        handler_class = get_guardrail_translation_mapping(
            CallTypes.generate_content_stream
        )
        assert handler_class == GoogleGenAIGenerateContentHandler

    def test_handler_discovered_for_agenerate_content_stream(self):
        handler_class = get_guardrail_translation_mapping(
            CallTypes.agenerate_content_stream
        )
        assert handler_class == GoogleGenAIGenerateContentHandler


class TestInputProcessing:
    @pytest.mark.asyncio
    async def test_presidio_skip_system_instruction_for_generate_content(self):
        handler = GoogleGenAIGenerateContentHandler()
        guardrail = RecordingGuardrail()

        data = {
            "model": "gemini-2.5-pro",
            "systemInstruction": {"parts": [{"text": "system secret"}]},
            "contents": [
                {"role": "user", "parts": [{"text": "hello world"}]},
            ],
        }

        result = await handler.process_input_messages(data, guardrail)

        assert result is data
        assert guardrail.last_inputs is not None
        assert guardrail.last_inputs["texts"] == ["hello world"]
        roles = {
            message.get("role")
            for message in (guardrail.last_inputs.get("structured_messages") or [])
        }
        assert roles == {"user"}
        assert data["systemInstruction"]["parts"][0]["text"] == "system secret"

    @pytest.mark.asyncio
    async def test_guardrailed_google_texts_round_trip_to_contents(self):
        handler = GoogleGenAIGenerateContentHandler()
        guardrail = UppercaseGuardrail()

        data = {
            "model": "gemini-2.5-pro",
            "contents": [
                {"role": "user", "parts": [{"text": "hello world"}]},
            ],
        }

        result = await handler.process_input_messages(data, guardrail)

        assert result["contents"][0]["parts"][0]["text"] == "HELLO WORLD"


class TestOutputProcessing:
    @pytest.mark.asyncio
    async def test_guardrailed_google_response_texts_round_trip(self):
        handler = GoogleGenAIGenerateContentHandler()
        guardrail = UppercaseGuardrail()

        response = GenerateContentResponse(
            candidates=[
                {
                    "content": {
                        "role": "model",
                        "parts": [{"text": "hello world"}],
                    }
                }
            ]
        )

        result = await handler.process_output_response(
            response=response,
            guardrail_to_apply=guardrail,
            request_data={"model": "gemini-2.5-pro"},
        )

        assert result.candidates[0]["content"]["parts"][0]["text"] == "HELLO WORLD"

    @pytest.mark.asyncio
    async def test_guardrailed_google_streaming_response_round_trip(self):
        handler = GoogleGenAIGenerateContentHandler()
        guardrail = UppercaseGuardrail()

        responses_so_far = [
            {"candidates": [{"content": {"parts": [{"text": "hello "}]}}]},
            {"candidates": [{"content": {"parts": [{"text": "world"}]}}]},
        ]

        result = await handler.process_output_streaming_response(
            responses_so_far=responses_so_far,
            guardrail_to_apply=guardrail,
            request_data={"model": "gemini-2.5-pro"},
        )

        assert (
            result[0]["candidates"][0]["content"]["parts"][0]["text"] == "HELLO WORLD"
        )
        assert result[1]["candidates"][0]["content"]["parts"][0]["text"] == ""
