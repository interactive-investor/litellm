from __future__ import annotations

from typing import Any, Collection, List, Set

from litellm.types.llms.openai import AllMessageValues


def effective_skip_system_message_for_guardrail(guardrail_to_apply: Any) -> bool:
    per = getattr(guardrail_to_apply, "skip_system_message_in_guardrail", None)
    if per is not None:
        return bool(per)
    import litellm

    return bool(getattr(litellm, "skip_system_message_in_guardrail", False))


def guardrail_excluded_openai_message_roles(guardrail_to_apply: Any) -> Set[str]:
    excluded_roles: Set[str] = set()

    if effective_skip_system_message_for_guardrail(guardrail_to_apply):
        excluded_roles.add("system")

    if bool(
        getattr(
            guardrail_to_apply,
            "presidio_skip_system_developer_message",
            False,
        )
    ):
        excluded_roles.update({"system", "developer"})

    return excluded_roles


def openai_messages_without_roles(
    messages: List[AllMessageValues],
    roles_to_exclude: Collection[str],
) -> List[AllMessageValues]:
    excluded_roles = {role.lower() for role in roles_to_exclude}
    if not excluded_roles:
        return list(messages)

    return [
        m
        for m in messages
        if str((m or {}).get("role") or "").lower() not in excluded_roles
    ]


def openai_messages_without_system(
    messages: List[AllMessageValues],
) -> List[AllMessageValues]:
    return openai_messages_without_roles(messages, {"system"})
