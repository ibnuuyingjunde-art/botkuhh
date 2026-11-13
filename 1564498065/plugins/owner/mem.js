/*
 * mem plugin - rincian pemakaian memori bot
 * Taruh di: plugins/owner/mem.js
 */
import v8 from 'v8';
import { getPanelMemory } from '../../src/lib/ichigo-panel-memory.js';
import { jadibotSessions } from '../../src/lib/ichigo-jadibot-manager.js';

const pluginConfig = {
	name: 'mem',
	alias: ['memori', 'ram', 'memusage'],
	category: 'owner',
	description: 'Rincian memori: rss, heap, external, buffer, jadibot',
	usage: '.mem [gc]',
	example: '.mem gc',
	isOwner: true,
	isPremium: false,
	isGroup: false,
	isPrivate: false,
	cooldown: 3,
	energi: 0,
	isEnabled: true,
};

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';

function snapshot() {
	const u = process.memoryUsage();
	const h = v8.getHeapStatistics();
	return { u, h };
}

async function handler(m, { text }) {
	const wantGc = /\bgc\b/i.test(String(text || ''));
	const before = snapshot();
	let gcNote = '';
	let after = null;

	if (wantGc) {
		if (typeof global.gc === 'function') {
			global.gc();
			after = snapshot();
		} else {
			gcNote = '\n\n_GC manual tidak aktif. Jalankan bot dengan_ `node --expose-gc index.js`';
		}
	}

	const { u, h } = after || before;

	const nonHeap = u.rss - u.heapTotal - u.external;
	const jadibots = jadibotSessions?.size ?? 0;
	const uptime = process.uptime();
	const up = `${Math.floor(uptime / 3600)}j ${Math.floor((uptime % 3600) / 60)}m`;

	let out = `*📊 Memori Bot* (uptime ${up})\n\n`;
	const panel = getPanelMemory();
	out += `• Panel (RAM): *${mb(panel.used)}*${panel.limit ? ` / ${mb(panel.limit)}` : ''} _(${panel.source})_\n`;
	out += `• RSS proses bot: *${mb(u.rss)}*\n`;
	out += `• Heap terpakai: ${mb(u.heapUsed)} / ${mb(u.heapTotal)}\n`;
	out += `• Batas heap: ${mb(h.heap_size_limit)}\n`;
	out += `• External (C++ / buffer): ${mb(u.external)}\n`;
	out += `• ArrayBuffers (media/buffer): ${mb(u.arrayBuffers)}\n`;
	out += `• Di luar heap (kode, native, fragmentasi): ~${mb(Math.max(nonHeap, 0))}\n`;
	out += `• Sesi jadibot: ${jadibots}`;
	if (jadibots > 0) out += ` (~${mb(u.rss / (jadibots + 1))} rata-rata per socket, kasar)`;

	if (after) {
		out += `\n\n*Setelah GC:* heap ${mb(before.u.heapUsed)} → ${mb(after.u.heapUsed)}, RSS ${mb(before.u.rss)} → ${mb(after.u.rss)}`;
	}

	out += `\n\n*Cara baca:*\n`;
	out += `• heapUsed tinggi & terus naik → kemungkinan leak di JS (Map/array)\n`;
	out += `• external/arrayBuffers tinggi → buffer media/ffmpeg\n`;
	out += `• RSS tinggi tapi heap kecil → normal, memori sudah dilepas tapi belum dikembalikan ke OS`;
	out += gcNote;

	return m.reply(out);
}

export { pluginConfig as config, handler };
