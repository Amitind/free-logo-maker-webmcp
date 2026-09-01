export type WebMcpCallStatus = 'running' | 'ok' | 'error';

export interface WebMcpCallLog {
	id: string;
	tool: string;
	args: unknown;
	status: WebMcpCallStatus;
	result?: unknown;
	error?: string;
	startedAt: number;
	endedAt?: number;
}

const MAX_LOGS = 50;
let logs: WebMcpCallLog[] = [];
const listeners = new Set<() => void>();

function notify() {
	for (const fn of listeners) fn();
}

export function subscribeWebMcpDebug(fn: () => void) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function getWebMcpLogs() {
	return logs;
}

export function startWebMcpCall(tool: string, args: unknown) {
	const id = `${tool}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
	logs = [
		{ id, tool, args, status: 'running' as const, startedAt: Date.now() },
		...logs,
	].slice(0, MAX_LOGS);
	notify();
	return id;
}

export function finishWebMcpCall(id: string, result: unknown) {
	logs = logs.map((l) =>
		l.id === id ? { ...l, status: 'ok', result, endedAt: Date.now() } : l,
	);
	notify();
}

export function failWebMcpCall(id: string, error: unknown) {
	logs = logs.map((l) =>
		l.id === id
			? { ...l, status: 'error', error: String(error), endedAt: Date.now() }
			: l,
	);
	notify();
}

function trackWebMcpCall(tool: string, status: 'ok' | 'error') {
	if (typeof window === 'undefined' || !('trackEvent' in window)) return;
	// @ts-expect-error trackEvent is declared inline in ProductionScripts.astro
	window.trackEvent('webmcp_tool_call', {
		tool_name: tool,
		status,
		page_path: window.location.pathname,
	});
}

/** Wraps a WebMCP tool's execute() so every call is logged for the debug panel
 * and reported to GA4 (see trackWebMcpCall) — covers every registerTool() call
 * site-wide, not just logo-maker, since they all route through this helper. */
export function withWebMcpLogging<
	T extends { name: string; execute: (args: any) => any },
>(def: T): T {
	return {
		...def,
		async execute(args: any) {
			const id = startWebMcpCall(def.name, args);
			try {
				const result = await def.execute(args);
				finishWebMcpCall(id, result);
				trackWebMcpCall(def.name, 'ok');
				return result;
			} catch (err) {
				failWebMcpCall(id, err);
				trackWebMcpCall(def.name, 'error');
				throw err;
			}
		},
	};
}
