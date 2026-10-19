# MCP and AI integration plan

Status: no MCP server or AI provider is implemented in Phase 1.

Use the [official MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk), not a bespoke protocol implementation. On 2026-10-19 its current README documents Python 3.11+, `MCPServer`, and stdio/Streamable HTTP/SSE; latest GitHub release observed was v2.3.0. This differs from older FastMCP-only examples. Pin and test the selected release at implementation time against the [official specification](https://github.com/modelcontextprotocol/modelcontextprotocol). Full current protocol and ChatGPT connector eligibility review remains a Phase 4 prerequisite.

The proposed local server name is `klinekraft-mcp`. HTTP routes, the controlled command registry and MCP tools will call the same Python service functions. Start with read-only `get_system_status`, `get_battery_status`, `get_gps_position`, `list_games`, `search_games`, `search_library`, `list_projects`, `get_network_status`. Results must carry availability/source/freshness. GPS and file/project lists can reveal private information; provide clear local capability controls.

`launch_game` is a mutation: require a locally approved game ID and an explicit one-use approval associated with the action. Never expose arbitrary shell strings, arbitrary paths, shutdown or credential access to model tools. Tool descriptions are not a security boundary; validate at the service layer.

Compatible local Claude desktop clients can launch a stdio process using an absolute executable path and argument list in their MCP configuration. Once implemented, document the exact installed command and test initialization/tool listing in that client. No usable configuration is supplied yet because there is no server to launch. Keep stdout reserved for protocol messages and log to stderr.

A ChatGPT cloud conversation cannot directly reach the Pi's localhost or launch its local stdio process. Remote use requires a supported reachable transport plus authentication and authorization, and current account/workspace connector support. Do not open router ports or publish an unauthenticated endpoint. Current ChatGPT plan eligibility and custom connector setup have not been verified in this iteration; verify official OpenAI documentation before offering remote integration.

OpenAI and Anthropic adapters should use official backend SDKs behind a provider interface, support streaming/cancellation/history and model selection, and label network errors and API costs. API usage is separate from ChatGPT/Claude subscription entitlements. Credentials belong in environment variables or permission-restricted local configuration, never `VITE_` variables, screenshots, logs or committed files. Local models remain an optional later experiment with explicit Pi performance limits.
