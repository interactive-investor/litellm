import os
import sys

sys.path.insert(0, os.path.abspath("../../../../.."))

from litellm.llms import get_guardrail_translation_mapping
from litellm.llms.pass_through.guardrail_translation.handler import (
    PassThroughEndpointHandler,
)
from litellm.types.utils import CallTypes


def test_handler_discovered_for_pass_through():
    handler_class = get_guardrail_translation_mapping(CallTypes.pass_through)
    assert handler_class == PassThroughEndpointHandler


def test_handler_discovered_for_llm_passthrough_route():
    handler_class = get_guardrail_translation_mapping(CallTypes.llm_passthrough_route)
    assert handler_class == PassThroughEndpointHandler


def test_handler_discovered_for_allm_passthrough_route():
    handler_class = get_guardrail_translation_mapping(CallTypes.allm_passthrough_route)
    assert handler_class == PassThroughEndpointHandler
