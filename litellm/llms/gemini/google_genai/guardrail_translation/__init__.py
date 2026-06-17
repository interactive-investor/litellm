from litellm.llms.gemini.google_genai.guardrail_translation.handler import (
    GoogleGenAIGenerateContentHandler,
)
from litellm.types.utils import CallTypes

guardrail_translation_mappings = {
    CallTypes.generate_content: GoogleGenAIGenerateContentHandler,
    CallTypes.agenerate_content: GoogleGenAIGenerateContentHandler,
    CallTypes.generate_content_stream: GoogleGenAIGenerateContentHandler,
    CallTypes.agenerate_content_stream: GoogleGenAIGenerateContentHandler,
}

__all__ = [
    "guardrail_translation_mappings",
    "GoogleGenAIGenerateContentHandler",
]
