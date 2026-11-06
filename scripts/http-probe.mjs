export async function probeHttpEndpoint(endpoint, { timeoutMs = 20000 } = {}) {
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid MCP HTTP URL');
  let id = 0;
  let session;
  async function request(method, params, notification = false) {
    const requestId = ++id;
    const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        ...(session ? { 'Mcp-Session-Id': session, 'MCP-Protocol-Version': '2024-11-05' } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', ...(!notification ? { id: requestId } : {}), method, params }) });
    if (!response.ok) throw new Error(`MCP HTTP ${method} failed: ${response.status}`);
    session = response.headers.get('mcp-session-id') || session;
    if (notification) { await response.body?.cancel(); return; }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let text = '', size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new Error('MCP HTTP response exceeded limit'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    let messages;
    try {
      messages = response.headers.get('content-type')?.includes('text/event-stream')
        ? text.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5).trim())) : [JSON.parse(text)];
    } catch { throw new Error('Malformed HTTP MCP response'); }
    const message = messages.find(candidate => candidate.id === requestId);
    if (!message || message.error) throw new Error(`MCP HTTP ${method} returned an invalid/error reply`);
    return message.result;
  }
  const initialized = await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'hela-http-doctor', version: '1.0.0' } });
  if (!initialized?.serverInfo?.version || !initialized.capabilities) throw new Error('Invalid HTTP MCP initialize response');
  await request('notifications/initialized', {}, true);
  const listed = await request('tools/list', {});
  if (!Array.isArray(listed?.tools) || !listed.tools.length) throw new Error('HTTP MCP returned no tools');
  const names = new Set();
  for (const tool of listed.tools) {
    if (typeof tool.name !== 'string' || !tool.inputSchema || names.has(tool.name)) throw new Error('Invalid/duplicate HTTP tool schema');
    names.add(tool.name);
  }
  return { serverInfo: initialized.serverInfo, tools: listed.tools, transport: 'http', scope: 'Remote MCP handshake/discovery only; source revisions and hardware/provider readiness are not observable.' };
}
