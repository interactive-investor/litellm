import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { RequestResponsePanel } from "./RequestResponsePanel";
import type { LogEntry } from "./columns";
import NotificationsManager from "../molecules/notifications_manager";

const mockNotificationsManager = vi.mocked(NotificationsManager);

const baseLogEntry: LogEntry = {
  request_id: "chatcmpl-test-id",
  api_key: "api-key",
  team_id: "team-id",
  model: "gpt-4",
  model_id: "gpt-4",
  call_type: "chat",
  spend: 0,
  total_tokens: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
  startTime: "2025-11-14T00:00:00Z",
  endTime: "2025-11-14T00:00:00Z",
  cache_hit: "miss",
  request_duration_ms: 1000,
  messages: [{ role: "user", content: "hello" }],
  response: { status: "ok" },
  metadata: {
    status: "success",
    additional_usage_values: {
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  },
  request_tags: {},
  custom_llm_provider: "openai",
  api_base: "https://api.example.com",
};

describe("RequestResponsePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  const renderPanel = (overrides?: Partial<React.ComponentProps<typeof RequestResponsePanel>>) => {
    const props: React.ComponentProps<typeof RequestResponsePanel> = {
      row: { original: baseLogEntry },
      hasClientRequest: true,
      hasModelRequest: true,
      hasModelResponse: true,
      hasClientResponse: true,
      hasError: false,
      errorInfo: null,
      getClientRequest: vi.fn().mockReturnValue({ client: "request" }),
      getModelRequest: vi.fn().mockReturnValue({ model: "request" }),
      getModelResponse: vi.fn().mockReturnValue({ model: "response" }),
      formattedResponse: vi.fn().mockReturnValue({ client: "response" }),
      ...overrides,
    };

    render(<RequestResponsePanel {...props} />);
    return props;
  };

  it("should render all four request and response panels", () => {
    renderPanel();

    expect(screen.getByText("Request from client")).toBeInTheDocument();
    expect(screen.getByText("Request to model/endpoint")).toBeInTheDocument();
    expect(screen.getByText("Response from model/endpoint")).toBeInTheDocument();
    expect(screen.getByText("Response to client")).toBeInTheDocument();
  });

  it("should copy client request to the clipboard", async () => {
    const user = userEvent.setup();
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(mockWriteText);

    const props = renderPanel({
      getClientRequest: vi.fn().mockReturnValue({ client: "request data" }),
    });

    await act(async () => {
      await user.click(screen.getByTitle("Copy request from client"));
    });

    expect(props.getClientRequest).toHaveBeenCalled();
    expect(mockWriteText).toHaveBeenCalledWith(JSON.stringify({ client: "request data" }, null, 2));
    expect(mockNotificationsManager.success).toHaveBeenCalledWith("Request from client copied to clipboard");
  });

  it("should copy model response to the clipboard", async () => {
    const user = userEvent.setup();
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(mockWriteText);

    const props = renderPanel({
      getModelResponse: vi.fn().mockReturnValue({ model: "response data" }),
    });

    await act(async () => {
      await user.click(screen.getByTitle("Copy response from model/endpoint"));
    });

    expect(props.getModelResponse).toHaveBeenCalled();
    expect(mockWriteText).toHaveBeenCalledWith(JSON.stringify({ model: "response data" }, null, 2));
    expect(mockNotificationsManager.success).toHaveBeenCalledWith("Response from model/endpoint copied to clipboard");
  });

  it("should use the formatted client response for the client response panel", async () => {
    const user = userEvent.setup();
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(mockWriteText);

    const props = renderPanel({
      getClientRequest: vi.fn().mockReturnValue({ shouldNot: "appear" }),
      formattedResponse: vi.fn().mockReturnValue({ client: "response data" }),
    });

    await act(async () => {
      await user.click(screen.getByTitle("Copy response to client"));
    });

    expect(props.formattedResponse).toHaveBeenCalled();
    expect(mockWriteText).toHaveBeenCalledWith(JSON.stringify({ client: "response data" }, null, 2));
    expect(mockNotificationsManager.success).toHaveBeenCalledWith("Response to client copied to clipboard");
  });

  it("should show the error code on the client response panel and keep copy enabled for errors", () => {
    renderPanel({
      hasModelResponse: false,
      hasClientResponse: true,
      hasError: true,
      errorInfo: { error_code: 429 },
      formattedResponse: vi.fn().mockReturnValue({
        error: { message: "Rate limit exceeded", type: "RateLimitError", code: 429, param: null },
      }),
    });

    expect(screen.getByText(/HTTP code 429/)).toBeInTheDocument();
    expect(screen.getByTitle("Copy response to client")).not.toBeDisabled();
    expect(screen.getByText("Response from model/endpoint not available")).toBeInTheDocument();
  });

  it("should show guidance when the model request is unavailable", () => {
    renderPanel({
      hasModelRequest: false,
    });

    expect(screen.getByText(/Request not available\. Enable/i)).toBeInTheDocument();
    expect(screen.getByText("store_prompts_in_spend_logs")).toBeInTheDocument();
    expect(screen.getByTitle("Copy request to model/endpoint")).toBeDisabled();
  });

  it("should show the client response empty state when no response data exists", () => {
    renderPanel({
      hasModelResponse: false,
      hasClientResponse: false,
      hasError: false,
    });

    expect(screen.getByText("Response to client not available")).toBeInTheDocument();
  });
});
