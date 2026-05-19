"""Pass-Through Endpoint guardrail translation handler."""

from litellm.llms.pass_through.guardrail_translation.handler import (
    PassThroughEndpointHandler,
)
from litellm.types.utils import CallTypes

guardrail_translation_mappings = {
    CallTypes.pass_through: PassThroughEndpointHandler,
    CallTypes.llm_passthrough_route: PassThroughEndpointHandler,
    CallTypes.allm_passthrough_route: PassThroughEndpointHandler,
}

__all__ = [
    "guardrail_translation_mappings",
    "PassThroughEndpointHandler",
]
