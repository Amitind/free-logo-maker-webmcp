import { useState, useSyncExternalStore } from 'react';
import {
	getWebMcpLogs,
	subscribeWebMcpDebug,
	type WebMcpCallLog,
} from '@/lib/webmcp-debug';

const DEMO_TASKS: { label: string; tool: string }[] = [
	{ label: 'Read current design', tool: 'get_logo_maker_state' },
	{ label: 'Search icon library', tool: 'search_logo_icons' },
	{ label: 'Preview the canvas', tool: 'get_logo_preview' },
	{ label: 'Update layers on canvas', tool: 'update_logo_maker_state' },
	{ label: 'Replace full canvas state', tool: 'replace_logo_maker_state' },
	{ label: 'Load a shared design', tool: 'load_logo_maker_share' },
];

function statusDot(status: WebMcpCallLog['status']) {
	if (status === 'running') return 'bg-amber-400 animate-pulse';
	if (status === 'ok') return 'bg-emerald-500';
	return 'bg-red-500';
}

function summarize(value: unknown, max = 90) {
	try {
		const s = JSON.stringify(value);
		if (!s) return '';
		return s.length > max ? `${s.slice(0, max)}…` : s;
	} catch {
		return String(value);
	}
}

/** Dev/demo-only overlay: shows live WebMCP tool calls and a running checklist. Not for end users. */
export function WebMcpDebugPanel() {
	const logs = useSyncExternalStore(
		subscribeWebMcpDebug,
		getWebMcpLogs,
		getWebMcpLogs,
	);
	const [open, setOpen] = useState(false);

	const doneTools = new Set(
		logs.filter((l) => l.status === 'ok').map((l) => l.tool),
	);
	const lastCall = logs[0];

	return (
		<div className='fixed bottom-4 right-4 z-[9999] max-w-[calc(100vw-2rem)] font-mono text-xs'>
			{open && (
				<div className='mb-2 w-96 max-h-[70vh] flex flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 shadow-2xl'>
					<div className='border-b border-neutral-800 px-3 py-2 font-semibold'>
						WebMCP debug
					</div>

					<div className='border-b border-neutral-800 px-3 py-2'>
						<div className='mb-1 text-neutral-400'>Agent task checklist</div>
						<ul className='space-y-1'>
							{DEMO_TASKS.map((task) => {
								const done = doneTools.has(task.tool);
								return (
									<li key={task.tool} className='flex items-center gap-2'>
										<span
											className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
												done
													? 'border-emerald-500 bg-emerald-500 text-neutral-950'
													: 'border-neutral-600'
											}`}
										>
											{done ? '✓' : ''}
										</span>
										<span
											className={done ? 'text-neutral-300' : 'text-neutral-500'}
										>
											{task.label}
										</span>
									</li>
								);
							})}
						</ul>
					</div>

					<div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2'>
						<div className='mb-1 text-neutral-400'>
							Activity {lastCall ? `· last: ${lastCall.tool}` : ''}
						</div>
						{logs.length === 0 && (
							<div className='text-neutral-600'>No WebMCP calls yet.</div>
						)}
						<ul className='space-y-2'>
							{logs.map((log) => (
								<li key={log.id} className='leading-snug'>
									<div className='flex items-center gap-2'>
										<span
											className={`h-2 w-2 rounded-full ${statusDot(log.status)}`}
										/>
										<span className='font-semibold'>{log.tool}</span>
										<span className='ml-auto text-neutral-600'>
											{new Date(log.startedAt).toLocaleTimeString()}
										</span>
									</div>
									<div className='pl-4 text-neutral-500 break-all'>
										args: {summarize(log.args)}
									</div>
									{log.status === 'ok' && (
										<div className='pl-4 text-neutral-500 break-all'>
											result: {summarize(log.result)}
										</div>
									)}
									{log.status === 'error' && (
										<div className='pl-4 text-red-400 break-all'>
											error: {log.error}
										</div>
									)}
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			<button
				type='button'
				onClick={() => setOpen((v) => !v)}
				className='flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-neutral-100 shadow-lg'
			>
				<span
					className={`h-2 w-2 rounded-full ${lastCall ? statusDot(lastCall.status) : 'bg-neutral-600'}`}
				/>
				WebMCP debug ({logs.length})
			</button>
		</div>
	);
}
