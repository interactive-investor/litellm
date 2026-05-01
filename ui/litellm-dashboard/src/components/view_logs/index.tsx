import { useState } from "react";
import useCan from "@/app/(dashboard)/hooks/useCan";
import DeletedKeysPage from "../DeletedKeysPage/DeletedKeysPage";
import DeletedTeamsPage from "../DeletedTeamsPage/DeletedTeamsPage";
import AuditLogsPanel from "./AuditLogsPanel";
import RequestLogsPanel from "./RequestLogsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UiLoadingSpinner } from "@/components/ui/ui-loading-spinner";

interface SpendLogsTableProps {
  accessToken: string | null;
  token: string | null;
  userRole: string | null;
  userID: string | null;
  premiumUser: boolean;
}

type LogsTabId = "request logs" | "audit logs" | "deleted keys" | "deleted teams";

interface LogsTab {
  id: LogsTabId;
  label: string;
}

const REQUEST_LOGS_TAB: LogsTab = { id: "request logs", label: "Request Logs" };
const AUDIT_LOGS_TAB: LogsTab = { id: "audit logs", label: "Audit Logs" };
const DELETED_KEYS_TAB: LogsTab = { id: "deleted keys", label: "Deleted Keys" };
const DELETED_TEAMS_TAB: LogsTab = { id: "deleted teams", label: "Deleted Teams" };

export default function SpendLogsTable({ accessToken, token, userRole, userID, premiumUser }: SpendLogsTableProps) {
  const [activeTab, setActiveTab] = useState<LogsTabId>(REQUEST_LOGS_TAB.id);
  const canViewAuditLogs = useCan("viewAuditLogs");
  const canViewDeletedTeams = useCan("viewDeletedTeams");

  if (!accessToken || !token || !userRole || !userID) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading" className="flex h-64 items-center justify-center">
        <UiLoadingSpinner className="size-8 text-primary" />
      </div>
    );
  }

  const tabs: LogsTab[] = [
    REQUEST_LOGS_TAB,
    ...(canViewAuditLogs ? [AUDIT_LOGS_TAB] : []),
    DELETED_KEYS_TAB,
    ...(canViewDeletedTeams ? [DELETED_TEAMS_TAB] : []),
  ];

  const renderPanel = (tabId: LogsTabId) => {
    switch (tabId) {
      case "request logs":
        return (
          <RequestLogsPanel
            accessToken={accessToken}
            token={token}
            userRole={userRole}
            userID={userID}
            isActive={activeTab === "request logs"}
          />
        );
      case "audit logs":
        return (
          <AuditLogsPanel
            userID={userID}
            userRole={userRole}
            token={token}
            accessToken={accessToken}
            isActive={activeTab === "audit logs"}
            premiumUser={premiumUser}
          />
        );
      case "deleted keys":
        return <DeletedKeysPage />;
      case "deleted teams":
        return <DeletedTeamsPage />;
    }
  };

  return (
    <div className="w-full max-w-screen p-6 overflow-x-hidden box-border">
      <TabGroup defaultIndex={0} onIndexChange={(index) => setActiveTab(index === 0 ? "request logs" : "audit logs")}>
        <TabList>
          <Tab>Request Logs</Tab>
          <Tab>Audit Logs</Tab>
          <Tab>Deleted Keys</Tab>
          <Tab>Deleted Teams</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-semibold">Request Logs</h1>
            </div>
            {selectedKeyInfo && selectedKeyIdInfoView && selectedKeyInfo.api_key === selectedKeyIdInfoView ? (
              <KeyInfoView
                keyId={selectedKeyIdInfoView}
                keyData={selectedKeyInfo}
                teams={allTeams ?? []}
                onClose={() => setSelectedKeyIdInfoView(null)}
                backButtonText="Back to Logs"
              />
            ) : (
              <>
                <FilterComponent
                  options={logFilterOptions}
                  onApplyFilters={handleFilterChange}
                  onResetFilters={handleFilterReset}
                />
                <div className="bg-white rounded-lg shadow w-full max-w-full box-border">
                  <div className="border-b px-6 py-4 w-full max-w-full box-border">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 w-full max-w-full box-border">
                      <div className="flex flex-wrap items-center gap-3 w-full max-w-full box-border">
                        <div className="relative w-64 min-w-0 flex-shrink-0">
                          <input
                            type="text"
                            placeholder="Search by Request ID"
                            className="w-full px-3 py-2 pl-8 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                          <svg
                            className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </div>

                        <div className="flex items-center gap-2 min-w-0 flex-shrink">
                          <div className="relative z-50" ref={quickSelectRef}>
                            <button
                              onClick={() => setQuickSelectOpen(!quickSelectOpen)}
                              className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              {displayLabel}
                            </button>

                            {quickSelectOpen && (
                              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border p-2 z-50">
                                <div className="space-y-1">
                                  {QUICK_SELECT_OPTIONS.map((option) => (
                                    <button
                                      key={option.label}
                                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-md ${displayLabel === option.label ? "bg-blue-50 text-blue-600" : ""
                                        }`}
                                      onClick={() => {
                                        setCurrentPage(1);
                                        setEndTime(moment().format("YYYY-MM-DDTHH:mm"));
                                        setStartTime(
                                          moment()
                                            .subtract(option.value, option.unit as any)
                                            .format("YYYY-MM-DDTHH:mm"),
                                        );
                                        setSelectedTimeInterval({ value: option.value, unit: option.unit });
                                        setIsCustomDate(false);
                                        setQuickSelectOpen(false);
                                      }}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                  <div className="border-t my-2" />
                                  <button
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-md ${isCustomDate ? "bg-blue-50 text-blue-600" : ""
                                      }`}
                                    onClick={() => setIsCustomDate(!isCustomDate)}
                                  >
                                    Custom Range
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <LiveTailControls />

                          <Button
                            type="default"
                            icon={<SyncOutlined spin={isButtonLoading} />}
                            onClick={handleRefresh}
                            disabled={isButtonLoading}
                            title="Fetch data"
                          >
                            {isButtonLoading ? "Fetching" : "Fetch"}
                          </Button>
                        </div>

                        {isCustomDate && (
                          <div className="flex items-center gap-2">
                            <div>
                              <input
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => {
                                  setStartTime(e.target.value);
                                  setCurrentPage(1);
                                }}
                                className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <span className="text-gray-500">to</span>
                            <div>
                              <input
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => {
                                  setEndTime(e.target.value);
                                  setCurrentPage(1);
                                }}
                                className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-700 whitespace-nowrap">
                          Showing {logs.isLoading ? "..." : filteredLogs ? (currentPage - 1) * pageSize + 1 : 0} -{" "}
                          {logs.isLoading
                            ? "..."
                            : filteredLogs
                              ? Math.min(currentPage * pageSize, filteredLogs.total)
                              : 0}{" "}
                          of {logs.isLoading ? "..." : filteredLogs ? filteredLogs.total : 0} results
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-700 min-w-[90px]">
                            Page {logs.isLoading ? "..." : currentPage} of{" "}
                            {logs.isLoading ? "..." : filteredLogs ? filteredLogs.total_pages : 1}
                          </span>
                          <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={logs.isLoading || currentPage === 1}
                            className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setCurrentPage((p) => Math.min(filteredLogs.total_pages || 1, p + 1))}
                            disabled={logs.isLoading || currentPage === (filteredLogs.total_pages || 1)}
                            className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {isLiveTail && currentPage === 1 && isMainQueryEnabled && (
                    <div className="mb-4 px-4 py-2 bg-green-50 border border-greem-200 rounded-md flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-green-700">Auto-refreshing every 15 seconds</span>
                      </div>
                      <button
                        onClick={() => setIsLiveTail(false)}
                        className="text-sm text-green-600 hover:text-green-800"
                      >
                        Stop
                      </button>
                    </div>
                  )}
                  <DataTable
                    columns={createColumns({
                      sortBy,
                      sortOrder,
                      onSortChange: (newSortBy, newSortOrder) => {
                        setSortBy(newSortBy);
                        setSortOrder(newSortOrder);
                        setCurrentPage(1);
                      },
                    })}
                    data={filteredData}
                    onRowClick={handleRowClick}
                    isLoading={logs.isLoading}
                  />
                </div>
              </>
            )}
          </TabPanel>
          <TabPanel>
            <AuditLogs
              userID={userID}
              userRole={userRole}
              token={token}
              accessToken={accessToken}
              isActive={activeTab === "audit logs"}
              premiumUser={premiumUser}
            />
          </TabPanel>
          <TabPanel><DeletedKeysPage /></TabPanel>
          <TabPanel><DeletedTeamsPage /></TabPanel>
        </TabPanels>
      </TabGroup>

      {/* Log Details Drawer */}
      <LogDetailsDrawer
        open={isDrawerOpen}
        onClose={handleCloseDrawer}
        logEntry={selectedLog}
        sessionId={selectedSessionId}
        accessToken={accessToken}
        allLogs={filteredData}
        onSelectLog={handleSelectLog}
        startTime={moment(startTime).utc().format("YYYY-MM-DD HH:mm:ss")}
      />
    </div>
  );
}

export function RequestViewer({ row }: { row: Row<LogEntry> }) {
  // Helper function to clean metadata by removing specific fields
  const formatData = (input: any) => {
    if (typeof input === "string") {
      try {
        return JSON.parse(input);
      } catch {
        return input;
      }
    }
    return input;
  };

  const hasData = (input: any) => {
    if (!input) {
      return false;
    }
    if (Array.isArray(input) || typeof input === "string") {
      return input.length > 0;
    }
    if (typeof input === "object") {
      return Object.keys(input).length > 0;
    }
    return true;
  };

  const proxyServerRequest = formatData(row.original.proxy_server_request);
  const modelRequest = formatData(row.original.messages);

  const getClientRequest = () => {
    if (hasData(proxyServerRequest)) {
      return proxyServerRequest;
    }
    return modelRequest;
  };

  const getModelRequest = () => modelRequest;

  // Extract error information from metadata if available
  const metadata = row.original.metadata || {};
  const hasError = metadata.status === "failure";
  const errorInfo = hasError ? metadata.error_information : null;

  // Check if request/response data is missing
  const hasMessages = hasData(modelRequest);
  const hasResponse = hasData(formatData(row.original.response));
  const hasClientRequest = hasData(proxyServerRequest);
  const hasClientResponse = hasResponse || hasError;
  const missingData = !hasMessages && !hasResponse && !hasClientRequest;

  // Format the response with error details if present
  const formattedResponse = () => {
    if (hasError && errorInfo) {
      return {
        error: {
          message: errorInfo.error_message || "An error occurred",
          type: errorInfo.error_class || "error",
          code: errorInfo.error_code || "unknown",
          param: null,
        },
      };
    }
    return formatData(row.original.response);
  };

  const getModelResponse = () => formatData(row.original.response);

  // Extract vector store request metadata if available
  const hasVectorStoreData =
    metadata.vector_store_request_metadata &&
    Array.isArray(metadata.vector_store_request_metadata) &&
    metadata.vector_store_request_metadata.length > 0;

  // Extract guardrail information from metadata if available
  const guardrailInfo = row.original.metadata?.guardrail_information;
  const guardrailEntries = Array.isArray(guardrailInfo) ? guardrailInfo : guardrailInfo ? [guardrailInfo] : [];
  const hasGuardrailData = guardrailEntries.length > 0;

  // Calculate total masked entities if guardrail data exists
  const totalMaskedEntities = guardrailEntries.reduce((sum, entry) => {
    const maskedCounts = entry?.masked_entity_count;
    if (!maskedCounts) {
      return sum;
    }
    return (
      sum +
      Object.values(maskedCounts).reduce<number>((acc, count) => (typeof count === "number" ? acc + count : acc), 0)
    );
  }, 0);

  const primaryGuardrailLabel =
    guardrailEntries.length === 1
      ? guardrailEntries[0]?.guardrail_name ?? "-"
      : guardrailEntries.length > 1
        ? `${guardrailEntries.length} guardrails`
        : "-";

  const truncatedRequestId = truncateString(row.original.request_id, 64);

  return (
    <div className="p-6 bg-gray-50 space-y-6 w-full max-w-full overflow-hidden box-border">
      {/* Combined Info Card */}
      <div className="bg-white rounded-lg shadow w-full max-w-full overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium">Request Details</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 w-full max-w-full overflow-hidden">
          <div className="space-y-2">
            <div className="flex">
              <span className="font-medium w-1/3">Request ID:</span>
              {row.original.request_id.length > 64 ? (
                <Tooltip title={row.original.request_id}>
                  <span className="font-mono text-sm">{truncatedRequestId}</span>
                </Tooltip>
              ) : (
                <span className="font-mono text-sm">{row.original.request_id}</span>
              )}
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">Model:</span>
              <span>{row.original.model}</span>
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">Model ID:</span>
              <span>{row.original.model_id}</span>
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">Call Type:</span>
              <span>{row.original.call_type}</span>
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">Provider:</span>
              <span>{row.original.custom_llm_provider || "-"}</span>
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">API Base:</span>
              <Tooltip title={row.original.api_base || "-"}>
                <span className="max-w-[15ch] truncate block">{row.original.api_base || "-"}</span>
              </Tooltip>
            </div>
            {row?.original?.requester_ip_address && (
              <div className="flex">
                <span className="font-medium w-1/3">IP Address:</span>
                <span>{row?.original?.requester_ip_address}</span>
              </div>
            )}
            {hasGuardrailData && (
              <div className="flex">
                <span className="font-medium w-1/3">Guardrail:</span>
                <div>
                  <span className="font-mono">{primaryGuardrailLabel}</span>
                  {totalMaskedEntities > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                      {totalMaskedEntities} masked
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex">
              <span className="font-medium w-1/3">Tokens:</span>
              <span>
                {row.original.total_tokens} ({row.original.prompt_tokens} prompt tokens +{" "}
                {row.original.completion_tokens} completion tokens)
              </span>
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">Cache Read Tokens:</span>
              <span>
                {formatNumberWithCommas(row.original.metadata?.additional_usage_values?.cache_read_input_tokens || 0)}
              </span>
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">Cache Creation Tokens:</span>
              <span>
                {formatNumberWithCommas(row.original.metadata?.additional_usage_values.cache_creation_input_tokens)}
              </span>
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">Cost:</span>
              <span>${formatNumberWithCommas(row.original.spend || 0, 6)}</span>
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">Cache Hit:</span>
              <span>{row.original.cache_hit}</span>
            </div>

            <div className="flex">
              <span className="font-medium w-1/3">Status:</span>
              <span
                className={`px-2 py-1 rounded-md text-xs font-medium inline-block text-center w-16 ${(row.original.metadata?.status || "Success").toLowerCase() !== "failure"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
                  }`}
              >
                {(row.original.metadata?.status || "Success").toLowerCase() !== "failure" ? "Success" : "Failure"}
              </span>
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">Start Time:</span>
              <span>{row.original.startTime}</span>
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">End Time:</span>
              <span>{row.original.endTime}</span>
            </div>
            <div className="flex">
              <span className="font-medium w-1/3">Duration:</span>
              <span>{row.original.request_duration_ms != null ? (row.original.request_duration_ms / 1000).toFixed(3) : "-"} s.</span>
            </div>
            {row.original.metadata?.litellm_overhead_time_ms !== undefined && (
              <div className="flex">
                <span className="font-medium w-1/3">LiteLLM Overhead:</span>
                <span>{row.original.metadata.litellm_overhead_time_ms} ms</span>
              </div>
            )}
            <div className="flex">
              <span className="font-medium w-1/3">Retries:</span>
              <span>
                {row.original.metadata?.attempted_retries !== undefined && row.original.metadata?.attempted_retries !== null
                  ? row.original.metadata.attempted_retries > 0
                    ? `${row.original.metadata.attempted_retries}${row.original.metadata.max_retries !== undefined && row.original.metadata.max_retries !== null ? ` / ${row.original.metadata.max_retries}` : ''}`
                    : <Tag color="green">None</Tag>
                  : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown - Show if cost breakdown data is available */}
      <CostBreakdownViewer
        costBreakdown={row.original.metadata?.cost_breakdown}
        totalSpend={row.original.spend ?? 0}
        promptTokens={row.original.prompt_tokens}
        completionTokens={row.original.completion_tokens}
        cacheHit={row.original.cache_hit}
      />

      {/* Configuration Info Message - Show when data is missing */}
      <ConfigInfoMessage show={missingData} />

      {/* Request/Response Panel */}
      <div className="w-full max-w-full overflow-hidden">
        <RequestResponsePanel
          row={row}
          hasClientRequest={hasClientRequest || hasMessages}
          hasModelRequest={hasMessages}
          hasModelResponse={hasResponse}
          hasClientResponse={hasClientResponse}
          hasError={hasError}
          errorInfo={errorInfo}
          getClientRequest={getClientRequest}
          getModelRequest={getModelRequest}
          getModelResponse={getModelResponse}
          formattedResponse={formattedResponse}
        />
      </div>

      {/* Guardrail Data - Show only if present */}
      {hasGuardrailData && <GuardrailViewer data={guardrailInfo} />}

      {/* Vector Store Request Data - Show only if present */}
      {hasVectorStoreData && <VectorStoreViewer data={metadata.vector_store_request_metadata} />}

      {/* Error Card - Only show for failures */}
      {hasError && errorInfo && <ErrorViewer errorInfo={errorInfo} />}

      {/* Tags Card - Only show if there are tags */}
      {row.original.request_tags && Object.keys(row.original.request_tags).length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-medium">Request Tags</h3>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(row.original.request_tags).map(([key, value]) => (
                <span key={key} className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                  {key}: {String(value)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Metadata Card - Only show if there's metadata */}
      {row.original.metadata && Object.keys(row.original.metadata).length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-medium">Metadata</h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(row.original.metadata, null, 2));
              }}
              className="p-1 hover:bg-gray-200 rounded"
              title="Copy metadata"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          <div className="p-4 overflow-auto max-h-64">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(row.original.metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
