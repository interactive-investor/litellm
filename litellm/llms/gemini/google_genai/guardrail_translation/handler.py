from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple, cast

from litellm._logging import verbose_proxy_logger
from litellm.google_genai.adapters.transformation import GoogleGenAIAdapter
from litellm.llms.base_llm.guardrail_translation.base_translation import BaseTranslation
from litellm.llms.base_llm.guardrail_translation.utils import (
    guardrail_excluded_openai_message_roles,
    openai_messages_without_roles,
)
from litellm.types.llms.openai import AllMessageValues, ChatCompletionToolParam
from litellm.types.utils import GenericGuardrailAPIInputs

if TYPE_CHECKING:
    from litellm.integrations.custom_guardrail import CustomGuardrail


TextTaskMapping = Tuple[str, int, int, bool]
OutputTextTaskMapping = Tuple[int, int, bool]


class GoogleGenAIGenerateContentHandler(BaseTranslation):
    def __init__(self) -> None:
        self._adapter = GoogleGenAIAdapter()

    def get_structured_messages(self, data: dict) -> Optional[List[AllMessageValues]]:
        contents = data.get("contents")
        if contents is None:
            return None

        completion_request = self._adapter.translate_generate_content_to_completion(
            model=data.get("model") or "",
            contents=contents,
            config=cast(
                Optional[Dict[str, Any]],
                data.get("generationConfig") or data.get("config"),
            ),
            systemInstruction=data.get("systemInstruction")
            or data.get("system_instruction"),
            tools=data.get("tools"),
            toolConfig=data.get("toolConfig") or data.get("tool_config"),
        )
        messages = completion_request.get("messages")
        return cast(Optional[List[AllMessageValues]], messages)

    def extract_request_tool_names(self, data: dict) -> List[str]:
        names: List[str] = []
        for tool in data.get("tools") or []:
            if not isinstance(tool, dict):
                continue
            for function_declaration in tool.get("functionDeclarations") or []:
                if isinstance(function_declaration, dict) and function_declaration.get(
                    "name"
                ):
                    names.append(str(function_declaration["name"]))
        return names

    async def process_input_messages(
        self,
        data: dict,
        guardrail_to_apply: "CustomGuardrail",
        litellm_logging_obj: Optional[Any] = None,
    ) -> Any:
        if data.get("contents") is None:
            return data

        excluded_roles = guardrail_excluded_openai_message_roles(guardrail_to_apply)
        texts_to_check: List[str] = []
        images_to_check: List[str] = []
        task_mappings: List[TextTaskMapping] = []

        self._extract_input_text_and_images(
            data=data,
            texts_to_check=texts_to_check,
            images_to_check=images_to_check,
            task_mappings=task_mappings,
            excluded_roles=excluded_roles,
        )

        tools_to_check = self._extract_request_tools(data)
        structured_messages = self.get_structured_messages(data)

        if not texts_to_check and not images_to_check and not tools_to_check:
            return data

        inputs = GenericGuardrailAPIInputs(texts=texts_to_check)
        if images_to_check:
            inputs["images"] = images_to_check
        if tools_to_check:
            inputs["tools"] = tools_to_check
        if structured_messages:
            inputs["structured_messages"] = (
                openai_messages_without_roles(structured_messages, excluded_roles)
                if excluded_roles
                else structured_messages
            )

        model = data.get("model")
        if model:
            inputs["model"] = model

        guardrailed_inputs = await guardrail_to_apply.apply_guardrail(
            inputs=inputs,
            request_data=data,
            input_type="request",
            logging_obj=litellm_logging_obj,
        )

        self._apply_guardrail_responses_to_input_texts(
            data=data,
            responses=guardrailed_inputs.get("texts", []),
            task_mappings=task_mappings,
        )

        verbose_proxy_logger.debug(
            "Google GenAI generateContent: Processed input messages"
        )
        return data

    async def process_output_response(
        self,
        response: Any,
        guardrail_to_apply: "CustomGuardrail",
        litellm_logging_obj: Optional[Any] = None,
        user_api_key_dict: Optional[Any] = None,
        request_data: Optional[dict] = None,
    ) -> Any:
        texts_to_check: List[str] = []
        task_mappings: List[OutputTextTaskMapping] = []

        self._extract_output_texts(
            response=response,
            texts_to_check=texts_to_check,
            task_mappings=task_mappings,
        )

        if not texts_to_check:
            return response

        if request_data is None:
            request_data = {"response": response}
        elif "response" not in request_data:
            request_data["response"] = response

        if "litellm_metadata" not in request_data:
            user_metadata = self.transform_user_api_key_dict_to_metadata(
                user_api_key_dict
            )
            if user_metadata:
                request_data["litellm_metadata"] = user_metadata

        inputs = GenericGuardrailAPIInputs(texts=texts_to_check)
        model = self._get_mapping_value(response, "model") or request_data.get("model")
        if model:
            inputs["model"] = model

        guardrailed_inputs = await guardrail_to_apply.apply_guardrail(
            inputs=inputs,
            request_data=request_data,
            input_type="response",
            logging_obj=litellm_logging_obj,
        )

        self._apply_guardrail_responses_to_output_texts(
            response=response,
            responses=guardrailed_inputs.get("texts", []),
            task_mappings=task_mappings,
        )

        return response

    async def process_output_streaming_response(
        self,
        responses_so_far: List[Any],
        guardrail_to_apply: "CustomGuardrail",
        litellm_logging_obj: Optional[Any] = None,
        user_api_key_dict: Optional[Any] = None,
        request_data: Optional[dict] = None,
    ) -> List[Any]:
        combined_text, text_mappings = self._collect_streaming_text(responses_so_far)
        if not combined_text:
            return responses_so_far

        if request_data is None:
            request_data = {"responses_so_far": responses_so_far}
        elif "responses_so_far" not in request_data:
            request_data["responses_so_far"] = responses_so_far

        if "litellm_metadata" not in request_data:
            user_metadata = self.transform_user_api_key_dict_to_metadata(
                user_api_key_dict
            )
            if user_metadata:
                request_data["litellm_metadata"] = user_metadata

        inputs = GenericGuardrailAPIInputs(texts=[combined_text])
        model = request_data.get("model") or self._get_mapping_value(
            responses_so_far[0], "model"
        )
        if model:
            inputs["model"] = model

        guardrailed_inputs = await guardrail_to_apply.apply_guardrail(
            inputs=inputs,
            request_data=request_data,
            input_type="response",
            logging_obj=litellm_logging_obj,
        )

        guardrailed_texts = guardrailed_inputs.get("texts", [])
        if not guardrailed_texts:
            return responses_so_far

        self._apply_guardrail_responses_to_output_stream(
            responses_so_far=responses_so_far,
            guardrail_text=guardrailed_texts[0],
            text_mappings=text_mappings,
        )

        return responses_so_far

    def _extract_request_tools(self, data: dict) -> List[ChatCompletionToolParam]:
        tools = data.get("tools") or []
        if not tools:
            return []
        return cast(
            List[ChatCompletionToolParam],
            self._adapter._transform_google_genai_tools_to_openai(tools),
        )

    def _extract_input_text_and_images(
        self,
        data: dict,
        texts_to_check: List[str],
        images_to_check: List[str],
        task_mappings: List[TextTaskMapping],
        excluded_roles: set[str],
    ) -> None:
        system_instruction = data.get("systemInstruction") or data.get(
            "system_instruction"
        )
        if "system" not in excluded_roles and isinstance(system_instruction, dict):
            for part_idx, part in enumerate(system_instruction.get("parts") or []):
                if isinstance(part, dict) and part.get("text") is not None:
                    texts_to_check.append(str(part["text"]))
                    task_mappings.append(("system", -1, part_idx, False))
                elif isinstance(part, str):
                    texts_to_check.append(part)
                    task_mappings.append(("system", -1, part_idx, True))

        for content_idx, content in enumerate(self._get_contents_list(data)):
            role = self._normalise_role(self._get_mapping_value(content, "role"))
            if role in excluded_roles:
                continue

            for part_idx, part in enumerate(self._get_parts_list(content)):
                if isinstance(part, dict):
                    text_value = part.get("text")
                    if text_value is not None:
                        texts_to_check.append(str(text_value))
                        task_mappings.append(("contents", content_idx, part_idx, False))

                    inline_data = part.get("inline_data")
                    if isinstance(inline_data, dict) and inline_data.get("data"):
                        mime_type = inline_data.get("mime_type", "image/jpeg")
                        images_to_check.append(
                            f"data:{mime_type};base64,{inline_data['data']}"
                        )
                elif isinstance(part, str):
                    texts_to_check.append(part)
                    task_mappings.append(("contents", content_idx, part_idx, True))

    def _apply_guardrail_responses_to_input_texts(
        self,
        data: dict,
        responses: List[str],
        task_mappings: List[TextTaskMapping],
    ) -> None:
        for task_idx, guardrail_response in enumerate(responses):
            if task_idx >= len(task_mappings):
                break

            source, content_idx, part_idx, is_string = task_mappings[task_idx]
            if source == "system":
                system_instruction = data.get("systemInstruction") or data.get(
                    "system_instruction"
                )
                if not isinstance(system_instruction, dict):
                    continue
                parts = system_instruction.get("parts") or []
            else:
                contents = self._get_contents_list(data)
                if content_idx >= len(contents):
                    continue
                parts = self._get_parts_list(contents[content_idx])

            if part_idx >= len(parts):
                continue

            if is_string:
                parts[part_idx] = guardrail_response
            elif isinstance(parts[part_idx], dict):
                parts[part_idx]["text"] = guardrail_response

    def _extract_output_texts(
        self,
        response: Any,
        texts_to_check: List[str],
        task_mappings: List[OutputTextTaskMapping],
    ) -> None:
        candidates = self._get_mapping_value(response, "candidates") or []
        for candidate_idx, candidate in enumerate(candidates):
            content = self._get_mapping_value(candidate, "content")
            if content is None:
                continue
            parts = self._get_mapping_value(content, "parts") or []
            for part_idx, part in enumerate(parts):
                if isinstance(part, dict) and part.get("text") is not None:
                    texts_to_check.append(str(part["text"]))
                    task_mappings.append((candidate_idx, part_idx, False))
                elif isinstance(part, str):
                    texts_to_check.append(part)
                    task_mappings.append((candidate_idx, part_idx, True))

    def _apply_guardrail_responses_to_output_texts(
        self,
        response: Any,
        responses: List[str],
        task_mappings: List[OutputTextTaskMapping],
    ) -> None:
        candidates = self._get_mapping_value(response, "candidates") or []
        for task_idx, guardrail_response in enumerate(responses):
            if task_idx >= len(task_mappings):
                break

            candidate_idx, part_idx, is_string = task_mappings[task_idx]
            if candidate_idx >= len(candidates):
                continue
            content = self._get_mapping_value(candidates[candidate_idx], "content")
            if content is None:
                continue
            parts = self._get_mapping_value(content, "parts") or []
            if part_idx >= len(parts):
                continue

            if is_string:
                parts[part_idx] = guardrail_response
            elif isinstance(parts[part_idx], dict):
                parts[part_idx]["text"] = guardrail_response

    def _collect_streaming_text(
        self,
        responses_so_far: List[Any],
    ) -> Tuple[str, List[Tuple[int, int, int, bool]]]:
        combined_text = ""
        text_mappings: List[Tuple[int, int, int, bool]] = []

        for response_idx, response in enumerate(responses_so_far):
            candidates = self._get_mapping_value(response, "candidates") or []
            for candidate_idx, candidate in enumerate(candidates):
                content = self._get_mapping_value(candidate, "content")
                if content is None:
                    continue
                parts = self._get_mapping_value(content, "parts") or []
                for part_idx, part in enumerate(parts):
                    if isinstance(part, dict) and part.get("text") is not None:
                        combined_text += str(part["text"])
                        text_mappings.append(
                            (response_idx, candidate_idx, part_idx, False)
                        )
                    elif isinstance(part, str):
                        combined_text += part
                        text_mappings.append(
                            (response_idx, candidate_idx, part_idx, True)
                        )

        return combined_text, text_mappings

    def _apply_guardrail_responses_to_output_stream(
        self,
        responses_so_far: List[Any],
        guardrail_text: str,
        text_mappings: List[Tuple[int, int, int, bool]],
    ) -> None:
        for mapping_idx, (
            response_idx,
            candidate_idx,
            part_idx,
            is_string,
        ) in enumerate(text_mappings):
            if response_idx >= len(responses_so_far):
                continue

            response = responses_so_far[response_idx]
            candidates = self._get_mapping_value(response, "candidates") or []
            if candidate_idx >= len(candidates):
                continue

            content = self._get_mapping_value(candidates[candidate_idx], "content")
            if content is None:
                continue

            parts = self._get_mapping_value(content, "parts") or []
            if part_idx >= len(parts):
                continue

            updated_text = guardrail_text if mapping_idx == 0 else ""
            if is_string:
                parts[part_idx] = updated_text
            elif isinstance(parts[part_idx], dict):
                parts[part_idx]["text"] = updated_text

    def _get_contents_list(self, data: dict) -> List[Dict[str, Any]]:
        contents = data.get("contents")
        if isinstance(contents, list):
            return cast(List[Dict[str, Any]], contents)
        if isinstance(contents, dict):
            return [contents]
        return []

    def _get_parts_list(self, content: Any) -> List[Any]:
        parts = self._get_mapping_value(content, "parts")
        if isinstance(parts, list):
            return parts
        return []

    def _get_mapping_value(self, item: Any, key: str) -> Any:
        if isinstance(item, dict):
            return item.get(key)
        return getattr(item, key, None)

    def _normalise_role(self, role: Optional[str]) -> str:
        if role == "model":
            return "assistant"
        return role or "user"
