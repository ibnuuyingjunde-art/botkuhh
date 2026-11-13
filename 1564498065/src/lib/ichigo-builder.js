/**
 * Do not remove this watermark.
 *
 * NIXCODE - Advanced WhatsApp Interactive Message Builder
 * Built for creating buttons, carousels, native flows,
 * and AI rich response payloads using Baileys with
 * fluent chaining, flexible payload customization,
 * and scalable architecture for modern bot development.
 *
 * Runtime:
 * - Baileys: @whiskeysockets/baileys (latest)
 *
 * Created by Nixel
 * Contributors:
 * - Ahmad tumbuh kembang
 * - popioo
 *
 * WhatsApp: wa.me/6285188349341
 * Channel: https://whatsapp.com/channel/0029VbCV1ck8fewpdNb2TY2k
 *
 * Copyright (c) 2026 Nixel
 *
 * Permission is granted to use and modify this library
 * for personal or commercial projects.
 *
 * Reuploading, reselling, relicensing, or redistributing
 * this library as a standalone product is prohibited.
 *
 * Do not claim this project as your own original work.
 */

'use strict';

const VERSION = '4.8-alpha';

import { generateWAMessageFromContent, prepareWAMessageMedia, generateMessageIDV2 } from 'ichigo';
import crypto from 'crypto';
import { sharp } from './ichigo-lazy.js';
import { ffmpeg } from './ichigo-lazy.js';
import { PassThrough, Readable } from 'stream';

const createEnum = (values) => {
	const names = Object.fromEntries(Object.entries(values).map(([name, value]) => [value, name]));
	return Object.freeze({
		...values,
		get: (value) => {
			if (typeof value === 'string') return value;
			if (typeof value !== 'number') return 'UNSET_OR_UNRECOGNIZED_ENUM_VALUE';
			return names[value] ?? 'UNSET_OR_UNRECOGNIZED_ENUM_VALUE';
		},
	});
};

const KEY = 0x5a;
const decode = (b64) => Buffer.from([...Buffer.from(b64, 'base64')].map((b) => b ^ KEY)).toString('utf8');

const Typenames = {
	INLINE_LINK: decode('FxgUMyI/NhM0NjM0P7jb+rja17Xi3bjb+LXi0Ljb+7ja0RYzNDE='),
	SEARCH_CITATION: decode('FxgUMyI/Ngk/Oyg5MhkzLju42/614ta42te14tG42ta14tO14tK42/suMzU0'),
	LATEX: decode('FxgUMyI/NhY7teLQteLcuNv7teLcteLUteLeteLeLj8i'),
	TEXT: decode('FxgUMyI/teLbteHlteLduNv6teLbteLcteLYNg4/Ii4='),
	FOA_TEXT: decode('FxgUMyI/NhwVGw642/m14tS42/q14ti42tG14tW14eW42/g/Ii4='),
	CODE: decode('FxgUM7Xi3Ljb+LXi2LXi2bjb+7Xi0Ljb+SI/Nhk1Pj8='),
	TABLE: decode('FxgUMyI/Ng47uNrWuNv+uNv6uNv+teLZteLateLTODY/'),
	SEARCH_RESULT: decode('FxgUMyK14ty14t+42/m14t+14te14ta14tw/Ngk/Oyg5Mgg/KS82Lg=='),
	SEARCH_RESULTV2: decode('FxgUMyI/Ngk/teLTteHluNv5teLZuNrRuNrXuNv7teLdOyg5Mgg/KS82Lgxo'),
	REEL: decode('FxgUMyI/NrXi2LXi3bXi3Ljb+rjb+7Xh5bXi3Qg/PzY='),
	POST: decode('FxgUMyI/Nrjb+rja17ja1rXi0LXi17Xi2Ao1KS4='),
	IMAGE: decode('FxgUM7Xi0rja17Xi27Xi0LXi3Ljb/rXi3iI/NhM3Oz0/'),
	IMAGINE: decode('FxgUMyI/NhM3Oz0zNLXi2bXi07Xi3Ljb+bXi07Xi1rjb+j8='),
	COMPACT: decode('FxgUMyI/Nhk1Nyo7Objb+bXi2bXi07Xi17ja0bjb+bXi17ja1i4='),
	PRODUCT: decode('FxgUMyI/NgooNT4vObXi27Xi1rXh5bXi3rjb/rXi0rXi1S4='),
	METADATA_TEXT: decode('FxgUMyI/Nhe42/m14eW14tq42/u14tW14tO14tE/Ljs+Oy47Dj8iLg=='),
	'3PEXTWIDGET': decode('FxgUMyI/NmkKteLateLSuNv4teLQteLWuNv+teLYHyIuDTM+PT8u'),
	'3PEXTWIDGET_HEADER': decode('FxgUMyI/NmkKHyK14tm14ty42ta42/m14ty14tm42/suDTM+PT8uEj87Pj8o'),
	'3PEXTWIDGET_EVENT_LIST': decode('F7Xi1LXi3LXi0LXi3Lja0bXi3bja17Xi1hgUMyI/NmkKHyIuDTM+PT8uHyw/NC4WMyku'),
	'3PEXTWIDGET_DATE_SECTION': decode('FxgUMyI/NmkKHyIuDTO42ta14tG14tu42tG42te42/614eU+PT8uHjsuPwk/OS4zNTQ='),
	'3PEXTWIDGET_EVENT_ITEM': decode('FxgUMyI/NmkKHyIuDTO42ta14tG14tu42tG42te42/614eU+PT8uHyw/NC4TLj83'),
	'3PEXTWIDGET_ATTENDEE': decode('FxgUMyI/teLYuNv6teLQuNrRteLQuNrWteLWNmkKHyIuDTM+PT8uGy4uPzQ+Pz8='),
	'3PEXTWIDGET_CTA': decode('FxgUMyI/NmkKHyIuDTM+PbXi0LXi17Xi3Lja1rXi27Xi1LXi2z8uGQ4b'),
	'3PEXTWIDGET_TOAST': decode('FxgUMyI/NmkKHyIuDTM+PT+42/u42/u42/u14eW42/u14tS14tAuDjU7KS4='),
	FOOTER_ACTION: decode('FxgUMyI/Nhw1NS4/KBs5teLateLeteLbteLYuNrRuNv6teLRteLVLjM1NA=='),
	SUGGESTION_PILL: decode('FxgUMyI/NgkvPT0/KS4zNTS42/u42/i14t614tC42tG42te14tW14toKMzY2'),
	HTML: decode('FxgUMyI/NhIuN7Xi3LXi17Xi1Lja0bjb+LXi0rjb+DY='),
	TASK: decode('FxgUMyI/Ng614eW42ta42te14te14tq14tK14tM7KTE='),
	PROFESSIONAL_CONSENT: decode('F7jb+rjb+rXh5bjb/rja0bXi2rjb+bXi2xgUMyI/NgooNTw/KSkzNTQ7Nhk1NCk/NC4='),
	FILE: decode('FxgUMyI/NhwzuNv7teLRteLeteLVteLSuNrXteLcNj8='),
	FILE_LINK: decode('FxgUMyI/NhwzNj8WMzS14ta42/u14t614ty14tG14t+14tMx'),
	QUOTA_UPSELL: decode('FxgUMyI/NrXi1rXi37ja17Xi0bja1rja17jb+rja1gsvNS47DyopPzY2'),
	BOT_PROGESS_STATUS: decode('FxgUMyI/Nhg1LgooNT0/KSkJLjsuteLSteLbteLYteHluNrRteLbuNv7teLTLyk='),
	BOT_THINKING_STATUS: decode('FxgUMyI/Nhg1Lg4yM7Xi07jb+rXi27Xi07ja0bjb+rXh5bXi1TQxMzQ9CS47Li8p'),
	FOA_EMBEDDED_SCREEN: decode('FxgUM7Xh5bXi3bXi1rja1rja0bjb+7Xi3Ljb+iI/NhwVGx83OD8+Pj8+CTkoPz80'),
	MAP: decode('FxgUMyI/NrXi17Xi1bja0bXi0bXi0rjb+7Xi2Rc7Kg=='),
	SPORTS_WIDGET: decode('FxgUMyI/NgkqNSguKbXi17ja1rXi0LXi17ja1rjb/rXi0bja0Q0zPj0/Lg=='),
	SPORTS_WIDGET_CONTENT: decode('FxgUMyI/NgkqNSguKQ242/u42/i14tW42/q42/614tS42tczPj0/Lhk1NC4/NC4='),
};

const Enums = Object.freeze({
	ADDON_ACTION_ALIGNMENT: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		END: 1,
		START: 2,
	}),

	ADDON_ACTION_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		COPY_TO_CLIPBOARD: 1,
		FOLLOW_UP_PROMPT: 2,
		SEND_TO_CHAT: 3,
	}),

	AGE_EXPERIENCE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		STANDARD: 1,
		U13: 2,
		U16_BR: 3,
		U18: 4,
		U18_BR: 5,
	}),

	AGE_EXPERIENCE_ACTION: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		SILENTLY_REMEDIATE: 1,
		UPDATE_AGE_EXPERIENCE: 2,
	}),

	ASSET_QUERY_STATUS: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		FAILED: 1,
		FETCHED: 2,
		FETCHING: 3,
	}),

	CALENDAR_ANALYTICS_ACTION: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		TAP_TO_CONFIRM_CANCEL_EVENT: 1,
		TAP_TO_CONFIRM_CREATE_EVENT: 2,
		TAP_TO_CONFIRM_UPDATE_EVENT: 3,
	}),

	CALENDAR_KIND: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		CANCEL: 1,
		CONFIRM: 2,
		OTHER: 3,
	}),

	CALENDAR_STATE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		CANCELLED: 1,
		CONFIRMED: 2,
		PENDING: 3,
	}),

	CATEGORY: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		ADD: 1,
		ANIMATE: 2,
		FRAME: 3,
		LIGHT: 4,
		OTHER: 5,
		RETOUCH: 6,
		SCENE: 7,
		STYLE: 8,
	}),

	COMMENT_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		COMMENT: 1,
		DEFAULT: 2,
		KEYWORD: 3,
		METHOD: 4,
		NUMBER: 5,
		STR: 6,
	}),

	COMPACT_ACTION_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		FOLLOW: 1,
		JOIN: 2,
		LEAVE: 3,
		MESSAGE: 4,
		UNFOLLOW: 5,
	}),

	COMPACT_ENTITY_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		CALENDAR_EVENT: 1,
		GROUP: 2,
		PAGE: 3,
		PERSON: 4,
	}),

	CONSENT_STATUS: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		ALLOWED: 1,
		NEEDS_CONSENT: 2,
	}),

	CTA_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		CANCEL_REASONING: 1,
		DOWNLOAD_MEDIA: 2,
		GENERATE_IMAGE: 3,
		OPEN_FULL_VIEW: 4,
		UPGRADE_TO_SUBS: 5,
	}),

	DIVIDER_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		DOT: 1,
		HORIZONTAL_LINE: 2,
	}),

	ENTITY_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		CALENDAR_EVENT: 1,
		FB_GROUP: 2,
		FB_PAGE: 3,
		FB_PROFILE: 4,
		IG_PROFILE: 5,
		THREADS_PROFILE: 6,
	}),

	IMAGINE_STATUS: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		FAILED: 1,
		GENERATING: 2,
		READY: 3,
	}),

	IMAGINE_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		ANIMATE: 1,
		IMAGINE: 2,
		MEMU: 3,
	}),

	IMMERSIVE_CONTENT_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		ATTACHMENT_WITH_LINK: 1,
		CAROUSEL_MULTI_PHOTO: 2,
		RESHARE_WITH_PHOTO: 3,
		SATP: 4,
		SINGLE_PHOTO: 5,
		SINGLE_PHOTO_SENSITIVE_CONTENT: 6,
		TEXT: 7,
	}),

	INFORM_TREATMENT: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		GEOBLOCK: 1,
		MEDIA_LABEL: 2,
		POST_COVER: 3,
		POST_LABEL: 4,
		WARNING_SCREENS: 5,
	}),

	INTEGRATION_STATUS: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		INITIATED: 1,
		LINKED: 2,
		UNLINKED: 3,
	}),

	MEDIA_HORIZONTAL_ALIGNMENT: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		END: 1,
		START: 2,
	}),

	MEDIA_SHAPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		CIRCLE: 1,
		SQUARE: 2,
		VERTICAL: 3,
	}),

	MEDIA_VERTICAL_ALIGNMENT: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		CENTER: 1,
		TOP: 2,
	}),

	PARENTAL_CONSENT_STATUS: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		AWAITING_PARENTAL_APPROVAL: 1,
		AWAITING_YOUTH_CONSENT: 2,
		COMPLETED: 3,
		O18_COMPLETED: 4,
		PENDING: 5,
		TEMP_BLOCK: 6,
		UNCHANGED: 7,
	}),

	PLANNER_STATUS: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		COMPLETED: 1,
		IN_PROGRESS: 2,
		PLANNED: 3,
		STOPPED: 4,
	}),

	POST_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		GROUP_POST: 1,
		PAGE_POST: 2,
	}),

	PRICE_LEVEL: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		CHEAP: 1,
		EXPENSIVE: 2,
		MODERATE: 3,
		SPLURGE: 4,
	}),

	PRODUCT_SOURCE_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		CATALOG: 1,
		MARKETPLACE: 2,
	}),

	QUICK_PROMPT_ICON: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		META_SEARCH: 1,
		THINKING: 2,
		WEB_SEARCH: 3,
	}),

	SEARCH_ENGINE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		BING: 1,
		BRAVE: 2,
		GOOGLE: 3,
		HELP_CENTER: 4,
		IN_HOUSE: 5,
		KSS: 6,
		MASE: 7,
	}),

	SOURCE_APP: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		FACEBOOK: 1,
		INSTAGRAM: 2,
		THREADS: 3,
	}),

	SOURCE_TYPE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		AI_GENERATED: 1,
		CATALOG_PRODUCT: 2,
		FACEBOOK_POST: 3,
		IMAGE_GEN: 4,
		INSTAGRAM_POST: 5,
		THIRD_PARTY: 6,
		THREADS_COMMUNITY: 7,
		THREADS_POST: 8,
		THREADS_TREND: 9,
		VM_GENERATED: 10,
		WEARABLES_ACS_ACTIVITY: 11,
		WEARABLES_ACS_JOURNAL: 12,
		WEARABLES_ACS_RECOMMENDATION: 13,
		WEARABLES_ACS_SPACE: 14,
		WEARABLES_AUDIO_NOTES: 15,
		WEB_REFERENCE_IMAGE: 16,
	}),

	SPORTS_GAME_STATUS: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		FINAL: 1,
		LIVE: 2,
		SCHEDULED: 3,
	}),

	SPORTS_LEAGUE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		EURO: 1,
		WORLD_CUP: 2,
	}),

	THIRD_PARTY_ACCOUNT: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		AFSE: 1,
		UNKU: 2,
		WAMO: 3,
		WOAS: 4,
	}),

	THIRD_PARTY_ROLE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		DEPENDENT: 1,
		NONE: 2,
		SPONSOR: 3,
		SPONSOR_ADMIN: 4,
	}),

	THIRD_PARTY_STATE: createEnum({
		UNSET_OR_UNRECOGNIZED_ENUM_VALUE: 0,
		ACTIVE: 1,
		RESERVED: 2,
	}),
});

class AIRichError extends Error {
	constructor(message, code, meta = {}) {
		super(message);
		this.name = 'AIRichError';
		this.code = code;
		Object.assign(this, meta);
	}
}

class ItemNotFoundError extends AIRichError {
	constructor(id, availableIds = []) {
		super(`Item id "${id}" not found${availableIds.length ? ` (available: ${availableIds.join(', ')})` : ' (no items have an id yet)'}`, 'ITEM_NOT_FOUND', { id, availableIds });
		this.name = 'ItemNotFoundError';
	}
}

class DuplicateIdError extends AIRichError {
	constructor(id) {
		super(`Item id "${id}" already exists`, 'DUPLICATE_ID', { id });
		this.name = 'DuplicateIdError';
	}
}

class InvalidTargetError extends AIRichError {
	constructor(message, meta = {}) {
		super(message, 'INVALID_TARGET', meta);
		this.name = 'InvalidTargetError';
	}
}

class ContentValidationError extends AIRichError {
	constructor(message, meta = {}) {
		super(message, 'CONTENT_VALIDATION', meta);
		this.name = 'ContentValidationError';
	}
}

class Toolkit {
	constructor() {}

	static extractIE(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
		if (!extract) {
			return {
				text,
				ie: [],
				inline_entities: [],
			};
		}

		const createIE = (type, ie) => {
			if (type == 'hyperlink') {
				return {
					key: ie.key,
					metadata: {
						display_name: ie.text,
						is_trusted: ie.is_trusted,
						url: ie.url,
						__typename: Typenames.INLINE_LINK,
					},
				};
			}

			if (type == 'citation') {
				return {
					key: ie.key,
					metadata: {
						reference_id: ie.reference_id,
						reference_url: ie.url,
						reference_title: ie.url,
						reference_display_name: ie.url,
						sources: [],
						__typename: Typenames.SEARCH_CITATION,
					},
				};
			}

			if (type == 'latex') {
				return {
					key: ie.key,
					metadata: {
						latex_expression: ie.text,
						latex_image: {
							url: ie.url,
							width: Number(ie.width) || 100,
							height: Number(ie.height) || 100,
						},
						font_height: Number(ie.font_height) || 83.333333333333,
						padding: Number(ie.padding) || 15,
						__typename: Typenames.LATEX,
					},
				};
			}
		};

		let ie = [];
		let inline_entities = [];
		let result = '';
		let last = 0;
		let citation_index = 1;
		let hyperlink_index = 0;
		let latex_index = 0;
		let stack = [];

		for (let i = 0; i < text.length; i++) {
			if (text[i] == '[' && text[i - 1] != '\\') {
				stack.push(i);
			} else if (text[i] == ']' && (text[i + 1] == '(' || text[i + 1] == '<')) {
				let start = stack.pop();

				if (start == null) continue;

				let open = text[i + 1];
				let close = open == '(' ? ')' : '>';
				let type = open == '(' ? 'link' : 'latex';
				let end = i + 2;
				let depth = 1;

				while (end < text.length && depth) {
					if (text[end] == open && text[end - 1] != '\\') depth++;
					else if (text[end] == close && text[end - 1] != '\\') depth--;
					end++;
				}

				if (depth) continue;

				let raw = text.slice(start + 1, i).trim();
				let url = text.slice(i + 2, end - 1).trim();

				let key;
				let tag;
				let data;

				if (type == 'latex') {
					if (!latex) continue;

					let [txt = '', width = null, height = null, font_height = null, padding = null] = raw.split('|');

					key = `\u004E\u0049\u0058\u0045\u004C_LATEX_${latex_index++}`;
					tag = `{{${key}}}${txt || 'image'}{{/${key}}}`;

					data = {
						type: 'latex',
						ie: {
							key,
							text: txt,
							url,
							width,
							height,
							font_height,
							padding,
						},
					};
				} else if (raw) {
					if (!hyperlink) continue;

					const trusted = !url.startsWith('!');

					if (!trusted) {
						url = url.slice(1);
					}

					key = `\u004E\u0049\u0058\u0045\u004C_HYPERLINK_${hyperlink_index++}`;
					tag = `{{${key}}}${url}{{/${key}}}`;

					data = {
						type: 'hyperlink',
						ie: {
							key,
							text: raw,
							url,
							is_trusted: trusted,
						},
					};
				} else {
					if (!citation) continue;

					key = `\u004E\u0049\u0058\u0045\u004C_CITATION_${citation_index - 1}`;
					tag = `{{${key}}}${url}{{/${key}}}`;

					data = {
						type: 'citation',
						ie: {
							reference_id: citation_index++,
							key,
							text: '',
							url,
						},
					};
				}

				result += text.slice(last, start) + tag;
				last = end;

				ie.push(data);

				const entity = createIE(data.type, data.ie);

				if (entity) {
					inline_entities.push(entity);
				}

				i = end - 1;
			}
		}

		result += text.slice(last);

		return {
			text: result,
			ie,
			inline_entities,
		};
	}

	static async resize(buffer, x, y, fit = 'cover') {
		return await sharp(buffer)
			.resize(x, y, {
				fit,
				position: 'center',
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png()
			.toBuffer();
	}

	static async waitAllPromises(input) {
		const isPromise = (v) => v && typeof v.then === 'function';
		const isObject = (v) => v && typeof v === 'object';

		const deep = async (v) => {
			if (isPromise(v)) return deep(await v);
			if (Array.isArray(v)) return Promise.all(v.map(deep));
			if (isObject(v)) {
				const entries = await Promise.all(Object.entries(v).map(async ([k, val]) => [k, await deep(val)]));
				return Object.fromEntries(entries);
			}
			return v;
		};

		return deep(await input);
	}

	static async fetchBuffer(url, options = {}, { silent = true } = {}) {
		try {
			let response = await fetch(url, options);
			if (!response.ok) throw Error(`HTTP ${response.status}`);
			return Buffer.from(await response.arrayBuffer());
		} catch (error) {
			if (silent) return Buffer.alloc(0);
			throw error;
		}
	}

	static async toUrl(_client, path, mediaType = 'document') {
		if (!path) throw new Error('Url or buffer needed');

		const media = await prepareWAMessageMedia(
			{
				[mediaType]: Buffer.isBuffer(path) ? path : { url: path },
			},
			{
				upload: _client.waUploadToServer,
				jid: '\u0040\u006e\u0065\u0077\u0073\u006c\u0065\u0074\u0074\u0065\u0072',
			}
		);

		return Object.values(media)[0]?.url;
	}

	static async resolveMedia(_client, media, mediaType = 'image', { resolveUrl = false, resolveWAUrl = false, result = 'url', resize = false, width = 300, height = 300 } = {}) {
		const isUrl = (str) => /^https?:\/\/.+/i.test(str);

		const isWAUrl = (str) => /^https?:\/\/[^/]*\.whatsapp\.net\//i.test(str);

		if (Array.isArray(media)) {
			return Promise.all(
				media.map((item) =>
					Toolkit.resolveMedia(_client, item, mediaType, {
						resolveUrl,
						resolveWAUrl,
						result,
						resize,
						width,
						height,
					})
				)
			);
		}

		const originalIsBuffer = Buffer.isBuffer(media);

		if (typeof media === 'string' && isUrl(media)) {
			if (isWAUrl(media)) {
				if (resolveWAUrl) {
					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				} else if (!resolveUrl) {
					if (result === 'url') return media;

					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				}
			} else {
				if (!resolveUrl) {
					if (result === 'url') return media;

					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				} else {
					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				}
			}
		}

		if (typeof media === 'string' && !isUrl(media)) {
			media = Buffer.from(media, 'base64');
		}

		if (!Buffer.isBuffer(media) || !media.length) {
			return;
		}

		if (resize && Buffer.isBuffer(media)) {
			media = await Toolkit.resize(media, width, height);
		}

		if (result === 'buffer') {
			return media;
		}

		if (result === 'base64') {
			return media.toString('base64');
		}

		if (originalIsBuffer) {
			return Toolkit.toUrl(_client, media, mediaType);
		}

		return Toolkit.toUrl(_client, media, mediaType);
	}

	static getMp4Duration(buffer, { silent = true } = {}) {
		try {
			if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
				if (silent) return 0;
				throw new Error('Invalid buffer');
			}

			let offset = 0;

			while (offset < buffer.length - 8) {
				const size = buffer.readUInt32BE(offset);

				if (size < 8 || offset + size > buffer.length) {
					if (silent) return 0;
					throw new Error('Invalid atom size');
				}

				const type = buffer.toString('ascii', offset + 4, offset + 8);

				if (type === 'moov') {
					let moovOffset = offset + 8;
					const moovEnd = offset + size;

					while (moovOffset < moovEnd - 8) {
						const childSize = buffer.readUInt32BE(moovOffset);

						if (childSize < 8 || moovOffset + childSize > moovEnd) {
							if (silent) return 0;
							throw new Error('Invalid child atom size');
						}

						const childType = buffer.toString('ascii', moovOffset + 4, moovOffset + 8);

						if (childType === 'mvhd') {
							const version = buffer.readUInt8(moovOffset + 8);

							if (version === 0) {
								const timescale = buffer.readUInt32BE(moovOffset + 20);
								const duration = buffer.readUInt32BE(moovOffset + 24);

								if (!timescale) {
									if (silent) return 0;
									throw new Error('Invalid timescale');
								}

								return duration / timescale;
							}

							if (version === 1) {
								const timescale = buffer.readUInt32BE(moovOffset + 32);
								const duration = Number(buffer.readBigUInt64BE(moovOffset + 36));

								if (!timescale) {
									if (silent) return 0;
									throw new Error('Invalid timescale');
								}

								return duration / timescale;
							}
						}

						moovOffset += childSize;
					}
				}

				offset += size;
			}

			if (silent) return 0;

			throw new Error('No mvhd found!');
		} catch (err) {
			if (silent) return 0;
			throw err;
		}
	}

	static getMp4Preview(videoBuffer, { time, result = 'buffer', resize = true, width = 300, height = 300, silent = true } = {}) {
		return new Promise((resolve, reject) => {
			const fail = (err) => {
				if (silent) {
					return resolve(result === 'base64' ? '' : Buffer.alloc(0));
				}
				return reject(err);
			};

			try {
				if (!Buffer.isBuffer(videoBuffer) || !videoBuffer.length) {
					return fail(new Error('videoBuffer tidak valid atau kosong'));
				}

				const inputStream = new Readable({ read() {} });
				inputStream.push(videoBuffer);
				inputStream.push(null);

				const outputStream = new PassThrough();
				const chunks = [];

				outputStream.on('data', (chunk) => chunks.push(chunk));

				outputStream.on('end', async () => {
					try {
						let output = Buffer.concat(chunks);

						if (!output.length) {
							return fail(new Error('Output kosong — cek format atau timestamp video'));
						}

						if (resize) {
							output = await Toolkit.resize(output, width, height);
						}

						return resolve(result === 'base64' ? output.toString('base64') : output);
					} catch (err) {
						return fail(err);
					}
				});

				outputStream.on('error', fail);

				time = time ?? Math.min(Toolkit.getMp4Duration(videoBuffer) * 0.2, 10);

				ffmpeg(inputStream)
					.outputOptions([`-ss ${time}`, '-vframes 1', '-vcodec png', '-f image2pipe'])
					.on('error', (err) => fail(new Error(`ffmpeg error: ${err.message}`)))
					.pipe(outputStream, { end: true });
			} catch (err) {
				return fail(err);
			}
		});
	}

	static stringifyEscaped(obj) {
		return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
	}
}

class BaseBuilder {
	constructor() {
		this._title = '';
		this._subtitle = '';
		this._body = '';
		this._footer = '';
		this._contextInfo = {};
		this._extraPayload = {};
	}

	setTitle(title) {
		if (typeof title !== 'string') {
			throw new TypeError('Title must be a string');
		}
		this._title = title;
		return this;
	}

	setSubtitle(subtitle) {
		if (typeof subtitle !== 'string') {
			throw new TypeError('Subtitle must be a string');
		}
		this._subtitle = subtitle;
		return this;
	}

	setBody(body) {
		if (typeof body !== 'string') {
			throw new TypeError('Body must be a string');
		}
		this._body = body;
		return this;
	}

	setFooter(footer) {
		if (typeof footer !== 'string') {
			throw new TypeError('Footer must be a string');
		}
		this._footer = footer;
		return this;
	}

	setContextInfo(obj) {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('ContextInfo must be a plain object');
		}

		this._contextInfo = obj;
		return this;
	}

	addPayload(obj) {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('Payload must be a plain object');
		}

		Object.assign(this._extraPayload, obj);

		return this;
	}
}

class Button extends BaseBuilder {
	#client;

	constructor(client) {
		super();
		if (!client) {
			throw new Error('Socket is required');
		}
		this.#client = client;

		this._buttons = [];
		this._data;
		this._currentSelectionIndex = -1;
		this._currentSectionIndex = -1;
		this._params = {};
	}

	loadFrom(msg) {
		if (!msg) throw new Error('interactiveMessage needed');
		if (!msg.interactiveMessage) throw new Error('interactiveMessage not found');

		const { interactiveMessage, ...extraPayload } = msg;
		const iM = interactiveMessage;
		const header = iM.header || {};
		const nativeFlow = iM.nativeFlowMessage || {};

		this._title = header.title || '';
		this._subtitle = header.subtitle || '';
		this._body = iM.body?.text || '';
		this._footer = iM.footer?.text || '';
		this._contextInfo = iM.contextInfo || {};
		this._extraPayload = extraPayload;

		this._buttons = Array.isArray(nativeFlow.buttons)
			? nativeFlow.buttons.map((button) => ({
					...button,
					buttonParamsJson: typeof button.buttonParamsJson === 'string' ? button.buttonParamsJson : JSON.stringify(button.buttonParamsJson || {}),
				}))
			: [];

		this._data = header.imageMessage
			? { imageMessage: header.imageMessage }
			: header.videoMessage
				? { videoMessage: header.videoMessage }
				: header.documentMessage
					? { documentMessage: header.documentMessage }
					: header.productMessage
						? { productMessage: header.productMessage }
						: undefined;

		this._params = {};

		if (typeof nativeFlow.messageParamsJson === 'string') {
			try {
				this._params = JSON.parse(nativeFlow.messageParamsJson || '{}');
			} catch {
				this._params = {};
			}
		} else if (nativeFlow.messageParamsJson && typeof nativeFlow.messageParamsJson === 'object') {
			this._params = { ...nativeFlow.messageParamsJson };
		}

		this._currentSelectionIndex = this._buttons.findLastIndex((button) => button.name === 'single_select');

		this._currentSectionIndex = -1;

		if (this._currentSelectionIndex !== -1) {
			try {
				const button = this._buttons[this._currentSelectionIndex];
				const params = JSON.parse(button.buttonParamsJson || '{}');

				if (Array.isArray(params.sections) && params.sections.length) {
					this._currentSectionIndex = params.sections.length - 1;
				}
			} catch {
				this._currentSelectionIndex = -1;
				this._currentSectionIndex = -1;
			}
		}

		return this;
	}

	setImage(path, options = {}) {
		if (!path) throw new Error('Url or buffer needed');
		Buffer.isBuffer(path) ? (this._data = { image: path, ...options }) : (this._data = { image: { url: path }, ...options });
		return this;
	}

	setDocument(path, options = {}) {
		if (!path) throw new Error('Url or buffer needed');
		Buffer.isBuffer(path) ? (this._data = { document: path, ...options }) : (this._data = { document: { url: path }, ...options });
		return this;
	}

	setMedia(obj) {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('Media must be a plain object');
		}

		this._data = obj;
		return this;
	}

	clearButtons() {
		this._buttons = [];
		return this;
	}

	setParams(obj) {
		this._params = obj;
		return this;
	}

	addButton(name, params) {
		this._buttons.push({
			name,
			buttonParamsJson: typeof params === 'string' ? params : JSON.stringify(params),
		});

		return this;
	}

	makeRow(header = '', title = '', description = '', id = '') {
		if (this._currentSelectionIndex === -1 || this._currentSectionIndex === -1) {
			throw new Error('You need to create a selection and a section first');
		}
		const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
		buttonParams.sections[this._currentSectionIndex].rows.push({ header, title, description, id });
		this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
		return this;
	}

	makeSection(title = '', highlight_label = '') {
		if (this._currentSelectionIndex === -1) {
			throw new Error('You need to create a selection first');
		}
		const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
		buttonParams.sections.push({ title, highlight_label, rows: [] });
		this._currentSectionIndex = buttonParams.sections.length - 1;
		this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
		return this;
	}

	addSelection(title, options = {}) {
		this._buttons.push({ name: 'single_select', buttonParamsJson: JSON.stringify({ title, sections: [], ...options }) });
		this._currentSelectionIndex = this._buttons.length - 1;
		this._currentSectionIndex = -1;
		return this;
	}

	addReply(display_text = '', id = '', options = {}) {
		this._buttons.push({
			name: 'quick_reply',
			buttonParamsJson: JSON.stringify({
				display_text,
				id,
				...options,
			}),
		});
		return this;
	}

	addCall(display_text = '', id = '', options = {}) {
		this._buttons.push({
			name: 'cta_call',
			buttonParamsJson: JSON.stringify({
				display_text,
				id,
				...options,
			}),
		});
		return this;
	}

	addReminder(display_text = '', id = '', options = {}) {
		this._buttons.push({
			name: 'cta_reminder',
			buttonParamsJson: JSON.stringify({
				display_text,
				id,
				...options,
			}),
		});
		return this;
	}

	addCancelReminder(display_text = '', id = '', options = {}) {
		this._buttons.push({
			name: 'cta_cancel_reminder',
			buttonParamsJson: JSON.stringify({
				display_text,
				id,
				...options,
			}),
		});
		return this;
	}

	addAddress(display_text = '', id = '', options = {}) {
		this._buttons.push({
			name: 'address_message',
			buttonParamsJson: JSON.stringify({
				display_text,
				id,
				...options,
			}),
		});
		return this;
	}

	addLocation(options = {}) {
		this._buttons.push({
			name: 'send_location',
			buttonParamsJson: JSON.stringify(options),
		});
		return this;
	}

	addUrl(display_text = '', url = '', webview_interaction = false, options = {}) {
		this._buttons.push({
			...options,
			name: 'cta_url',
			buttonParamsJson: JSON.stringify({
				display_text,
				url,
				webview_interaction,
				...options,
			}),
		});
		return this;
	}

	addCopy(display_text = '', copy_code = '', options = {}) {
		this._buttons.push({
			name: 'cta_copy',
			buttonParamsJson: JSON.stringify({
				display_text,
				copy_code,
				...options,
			}),
		});
		return this;
	}

	static paramsList = {
		limited_time_offer: {
			text: 'string',
			url: 'string',
			copy_code: 'string',
			expiration_time: 'number',
		},
		bottom_sheet: {
			in_thread_buttons_limit: 'number',
			divider_indices: ['number'],
			list_title: 'string',
			button_title: 'string',
		},
		tap_target_configuration: {
			title: 'string',
			description: 'string',
			canonical_url: 'string',
			domain: 'string',
			buttonIndex: 'number',
		},
	};

	async toCard() {
		return {
			body: {
				text: this._body,
			},
			footer: {
				text: this._footer,
			},
			header: {
				title: this._title,
				subtitle: this._subtitle,
				hasMediaAttachment: !!this._data,
				...(this._data
					? await prepareWAMessageMedia(this._data, { upload: this.#client.waUploadToServer }).catch((e) => {
							if (String(e).includes('Invalid media type')) return this._data;
							throw e;
						})
					: {}),
			},
			nativeFlowMessage: {
				messageParamsJson: JSON.stringify(this._params),
				buttons: this._buttons,
			},
		};
	}

	async build(jid, { messageId, ...options } = {}) {
		const message = await this.toCard();

		return generateWAMessageFromContent(
			jid,
			{
				...this._extraPayload,
				interactiveMessage: {
					...message,
					contextInfo: this._contextInfo,
				},
			},
			{ messageId: messageId || generateMessageIDV2(), ...options }
		);
	}

	async send(jid, { messageId, additionalNodes = [], ...options } = {}) {
		const msg = await this.build(jid, { messageId, ...options });

		await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [
				{
					tag: 'biz',
					attrs: {},
					content: [
						{
							tag: 'interactive',
							attrs: { type: 'native_flow', v: '1' },
							content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
						},
					],
				},
				...additionalNodes,
			],
			...options,
		});
		return msg;
	}
}

class ButtonV2 extends BaseBuilder {
	#client;

	constructor(client) {
		super();
		if (!client) {
			throw new Error('Socket is required');
		}

		this.#client = client;
		this._image;
		this._data;
		this._buttons = [];
	}

	loadFrom(msg) {
		if (!msg) throw new Error('buttonsMessage needed');
		if (!msg.buttonsMessage) throw new Error('buttonsMessage not found');

		const { buttonsMessage, ...extraPayload } = msg;
		const bM = buttonsMessage;
		const location = bM.locationMessage || {};

		this._title = location.name || '';
		this._subtitle = location.address || '';
		this._body = bM.contentText || '';
		this._footer = bM.footerText || '';
		this._contextInfo = bM.contextInfo || {};
		this._extraPayload = extraPayload;

		this._buttons = Array.isArray(bM.buttons)
			? bM.buttons.map((button) => ({
					...button,
					...(button.nativeFlowInfo
						? {
								nativeFlowInfo: {
									...button.nativeFlowInfo,
									paramsJson: typeof button.nativeFlowInfo.paramsJson === 'string' ? button.nativeFlowInfo.paramsJson : JSON.stringify(button.nativeFlowInfo.paramsJson || {}),
								},
							}
						: {}),
				}))
			: [];

		this._image = location.jpegThumbnail || undefined;

		if (!this._image && bM.locationMessage) {
			this._image = undefined;
		}

		if (!bM.locationMessage && bM.headerType === 6) {
			this._image = undefined;
		}

		this._data = Object.keys(bM).reduce((data, key) => {
			if (!['contentText', 'footerText', 'contextInfo', 'buttons', 'headerType', 'locationMessage', 'viewOnce'].includes(key)) {
				data[key] = bM[key];
			}
			return data;
		}, {});

		if (!Object.keys(this._data).length) {
			this._data = undefined;
		}

		return this;
	}

	addButton(displayText = '', buttonId = crypto.randomUUID()) {
		this._buttons.push({
			buttonId,
			buttonText: { displayText },
			type: 1,
		});
		return this;
	}

	addRawButton(obj) {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('Buttons must be a plain object');
		}

		this._buttons.push(obj);
		return this;
	}

	setRawThumbnail(thumbnail) {
		if (!thumbnail) throw new Error('Thumbnail needed');
		this._image = { base64: thumbnail, is_raw: true };
		return this;
	}

	setThumbnail(path) {
		if (!path) throw new Error('Url or buffer needed');
		this._image = path;
		return this;
	}

	setMedia(obj) {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('Media must be a plain object');
		}

		this._data = obj;
		return this;
	}

	async build(jid, { messageId, ...options } = {}) {
		const _thumbnail = this._image?.is_raw
			? this._image.base64
			: this._image
				? await Toolkit.resize(Buffer.isBuffer(this._image) ? this._image : await Toolkit.fetchBuffer(this._image, {}, { silent: true }), 300, 300)
				: null;
		const msg = generateWAMessageFromContent(
			jid,
			{
				...this._extraPayload,
				buttonsMessage: {
					contentText: this._body,
					footerText: this._footer,
					...(this._data
						? this._data
						: {
								headerType: 6,
								locationMessage: {
									degreesLatitude: 0,
									degreesLongitude: 0,
									name: this._title,
									address: this._subtitle,
									jpegThumbnail: _thumbnail,
								},
							}),
					viewOnce: true,
					contextInfo: this._contextInfo,
					buttons: [...this._buttons],
				},
			},
			{ messageId: messageId || generateMessageIDV2(), ...options }
		);
		return msg;
	}

	async send(jid, { messageId, additionalNodes = [], ...options } = {}) {
		if (this._buttons.length < 1) throw new Error('ButtonV2 requires at least one button');
		const msg = await this.build(jid, { messageId, ...options });

		await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [
				{
					tag: 'biz',
					attrs: {},
					content: [
						{
							tag: 'interactive',
							attrs: { type: 'native_flow', v: '1' },
							content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
						},
					],
				},
				...additionalNodes,
			],
			...options,
		});
		return msg;
	}
}

class Carousel extends BaseBuilder {
	#client;

	constructor(client) {
		super();
		if (!client) {
			throw new Error('Socket is required');
		}

		this.#client = client;
		this._cards = [];
	}

	loadFrom(msg) {
		if (!msg) throw new Error('interactiveMessage needed');
		if (!msg.interactiveMessage) throw new Error('interactiveMessage not found');

		const { interactiveMessage, ...extraPayload } = msg;
		const iM = interactiveMessage;
		const carousel = iM.carouselMessage || {};

		this._body = iM.body?.text || '';
		this._footer = iM.footer?.text || '';
		this._contextInfo = iM.contextInfo || {};
		this._extraPayload = extraPayload;

		this._cards = Array.isArray(carousel.cards)
			? carousel.cards.map((card) => ({
					...card,
					header: {
						...(card.header || {}),
						hasMediaAttachment: !!card.header?.hasMediaAttachment,
						...(card.header?.imageMessage ? { imageMessage: card.header.imageMessage } : {}),
						...(card.header?.videoMessage ? { videoMessage: card.header.videoMessage } : {}),
					},
					body: {
						text: card.body?.text || '',
					},
					footer: {
						text: card.footer?.text || '',
					},
					nativeFlowMessage: {
						...(card.nativeFlowMessage || {}),
						buttons: Array.isArray(card.nativeFlowMessage?.buttons)
							? card.nativeFlowMessage.buttons.map((button) => ({
									...button,
									buttonParamsJson: typeof button.buttonParamsJson === 'string' ? button.buttonParamsJson : JSON.stringify(button.buttonParamsJson || {}),
								}))
							: [],
						messageParamsJson:
							typeof card.nativeFlowMessage?.messageParamsJson === 'string' ? card.nativeFlowMessage.messageParamsJson : JSON.stringify(card.nativeFlowMessage?.messageParamsJson || {}),
					},
				}))
			: [];

		return this;
	}

	addCard(card) {
		const cards = Array.isArray(card) ? card : [card];
		const baseIndex = this._cards.length;

		for (const [index, c] of cards.entries()) {
			if (!c?.header?.hasMediaAttachment) {
				throw new Error(`Card [${baseIndex + index}] must include an image or video in header`);
			}
		}

		this._cards.push(...cards);
		return this;
	}

	build(jid, { messageId, ...options } = {}) {
		return generateWAMessageFromContent(
			jid,
			{
				...this._extraPayload,
				interactiveMessage: {
					header: {
						hasMediaAttachment: false,
					},
					body: { text: this._body },
					footer: { text: this._footer },
					contextInfo: this._contextInfo,
					carouselMessage: {
						cards: this._cards,
					},
				},
			},
			{ messageId: messageId || generateMessageIDV2(), ...options }
		);
	}

	async send(jid, { messageId, additionalNodes = [], ...options } = {}) {
		const msg = this.build(jid, { messageId, ...options });

		await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [
				{
					tag: 'biz',
					attrs: {},
					content: [
						{
							tag: 'interactive',
							attrs: { type: 'native_flow', v: '1' },
							content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
						},
					],
				},
				...additionalNodes,
			],
			...options,
		});
		return msg;
	}
}

class AIRich extends BaseBuilder {
	#client;

	constructor(client, { dynamic = true, unsupportedTypeAlert = true } = {}) {
		if (!client) {
			throw new Error('Socket is required');
		}

		super();
		this.#client = client;
		this._contextInfo = {};
		this._nodes = [];
		this._idIndex = new Map();
		this._unsupportedTypeAlert = !!unsupportedTypeAlert;
		this._dynamic = !!dynamic;
		this._responseId = crypto.randomUUID();
		this._botResponseId = crypto.randomUUID();
		this._lastMessageKey = null;
	}

	loadFrom(msg) {
		if (!msg) throw new Error('AI Rich message needed');

		const message = msg.message ?? msg;

		let richResponseMessage = message?.botForwardedMessage?.message?.richResponseMessage;

		if (!richResponseMessage) {
			richResponseMessage = message?.botForwardedMessage?.richResponseMessage;
		}

		if (!richResponseMessage) {
			richResponseMessage = message?.richResponseMessage;
		}

		if (!richResponseMessage) {
			throw new Error('richResponseMessage not found');
		}

		const messageContextInfo = message?.messageContextInfo ?? {};
		const botMetadata = messageContextInfo?.botMetadata ?? {};

		this._title = botMetadata?.messageDisclaimerText ?? '';

		this._contextInfo = structuredClone(richResponseMessage?.contextInfo ?? {});

		const loadedSubmessages = Array.isArray(richResponseMessage?.submessages) ? structuredClone(richResponseMessage.submessages) : [];

		let loadedSections = [];

		const unifiedData = richResponseMessage?.unifiedResponse?.data;

		if (unifiedData) {
			try {
				const decoded = Buffer.from(unifiedData, 'base64').toString('utf8');
				const unifiedResponse = JSON.parse(decoded);

				if (Array.isArray(unifiedResponse?.sections)) {
					loadedSections = structuredClone(unifiedResponse.sections);
				}
			} catch {}
		}

		this._nodes = [];
		this._idIndex = new Map();

		const maxLength = Math.max(loadedSections.length, loadedSubmessages.length);

		for (let i = 0; i < maxLength; i++) {
			this._nodes.push({
				id: null,
				section: loadedSections[i] ?? null,
				submessage: loadedSubmessages[i] ?? null,
			});
		}

		this._extraPayload = {};

		for (const [key, value] of Object.entries(message)) {
			if (key !== 'messageContextInfo' && key !== 'botForwardedMessage' && key !== 'richResponseMessage') {
				this._extraPayload[key] = structuredClone(value);
			}
		}

		return this;
	}

	setResponseId(id) {
		if (typeof id !== 'string') {
			throw new TypeError('ID must be a string');
		}
		this._responseId = id;

		return this;
	}

	refreshResponseId() {
		this._responseId = crypto.randomUUID();

		return this;
	}

	setBotResponseId(id) {
		if (typeof id !== 'string') {
			throw new TypeError('ID must be a string');
		}
		this._botResponseId = id;

		return this;
	}

	refreshBotResponseId() {
		this._botResponseId = crypto.randomUUID();

		return this;
	}

	createAlert(type) {
		if (this._unsupportedTypeAlert) {
			return {
				messageType: 2,
				messageText: `[ UNSUPPORTED_TYPE - ${type}]`,
			};
		}

		return undefined;
	}

	addText(text, { hyperlink = true, citation = true, latex = true, id, replace, insertAt } = {}) {
		if (typeof text !== 'string') {
			throw new TypeError('Text must be a string');
		}

		const { text: extractedText, inline_entities } = Toolkit.extractIE(text, {
			hyperlink,
			citation,
			latex,
		});

		const section = AIRich.newLayout('Single', {
			text: extractedText,
			...(inline_entities.length && { inline_entities }),
			__typename: Typenames.TEXT,
		});

		const submessages = [
			{
				messageType: 2,
				messageText: text,
			},
		].filter(Boolean);

		return this._addContent(section, submessages, {
			id,
			replace,
			insertAt,
		});
	}

	addFOAText(text, { id, replace, insertAt } = {}) {
		if (typeof text !== 'string') {
			throw new TypeError('Text must be a string');
		}

		const section = AIRich.newLayout('Single', {
			text,
			__typename: Typenames.FOA_TEXT,
		});

		const submessages = [
			{
				messageType: 2,
				messageText: text,
			},
		];

		return this._addContent(section, submessages, {
			id,
			replace,
			insertAt,
		});
	}

	addCode(language, code, { id, replace, insertAt } = {}) {
		if (typeof language !== 'string' || typeof code !== 'string') {
			throw new TypeError('Language and code must be a string');
		}

		const meta = AIRich.tokenizer(code, language);

		const section = AIRich.newLayout('Single', {
			language,
			code_blocks: meta.unified_codeBlock,
			__typename: Typenames.CODE,
		});

		const submessages = [
			{
				messageType: 5,
				codeMetadata: {
					codeLanguage: language,
					codeBlocks: meta.codeBlock,
				},
			},
		];

		return this._addContent(section, submessages, {
			id,
			replace,
			insertAt,
		});
	}

	addTable(table, { hyperlink = true, citation = true, latex = true, id, replace, insertAt } = {}) {
		if (!Array.isArray(table)) {
			throw new TypeError('Table must be an array');
		}

		const meta = AIRich.toTableMetadata(table, {
			hyperlink,
			citation,
			latex,
		});

		const section = AIRich.newLayout('Single', {
			rows: meta.unified_rows,
			__typename: Typenames.TABLE,
		});

		const submessages = [
			{
				messageType: 4,
				tableMetadata: {
					title: meta.title,
					rows: meta.rows,
				},
			},
		];

		return this._addContent(section, submessages, {
			id,
			replace,
			insertAt,
		});
	}

	addSource(sources = [], { id, replace, insertAt } = {}) {
		if (!Array.isArray(sources)) {
			throw new TypeError('Sources must be an array of strings, arrays, or objects');
		}

		const isStringArray = sources.every((item) => typeof item === 'string');

		const isArrayFormat = sources.every((item) => Array.isArray(item) && item.every((value) => typeof value === 'string'));

		const isObjectFormat = sources.every((item) => item && typeof item === 'object' && !Array.isArray(item));

		if (!isStringArray && !isArrayFormat && !isObjectFormat) {
			throw new TypeError('Sources must be a string array, array of string arrays, or array of objects');
		}

		if (isStringArray) {
			sources = [sources];
		}

		const normalizedSources = sources.map((source) => {
			if (Array.isArray(source)) {
				const [icon, url, title, subtitle] = source;

				return {
					icon,
					url,
					title,
					subtitle,
				};
			}

			return {
				icon: source.favicon ?? source.icon ?? '',
				url: source.url ?? '',
				title: source.title ?? '',
				subtitle: source.subtitle ?? '',
			};
		});

		const source = normalizedSources.map(({ icon, url, title, subtitle }) => ({
			source_type: Enums.SOURCE_TYPE.get(6),
			source_display_name: title,
			source_subtitle: subtitle,
			source_url: url,
			favicon: {
				url: Toolkit.resolveMedia(this.#client, icon, 'image'),
				mime_type: 'image/jpeg',
				width: 16,
				height: 16,
			},
		}));

		const submessage = this.createAlert(Typenames.SEARCH_RESULT);

		const section = AIRich.newLayout('Single', {
			sources: source,
			__typename: Typenames.SEARCH_RESULT,
		});

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addReels(reelsItems = [], { id, replace, insertAt } = {}) {
		if (
			!(
				(reelsItems && typeof reelsItems === 'object' && !Array.isArray(reelsItems)) ||
				(Array.isArray(reelsItems) && reelsItems.every((item) => item && typeof item === 'object' && !Array.isArray(item)))
			)
		) {
			throw new TypeError('Reels items must be an object or an array of objects');
		}

		const items = Array.isArray(reelsItems) ? reelsItems : [reelsItems];

		const reels = items.map((item) => ({
			...item,
			_avatar: Toolkit.resolveMedia(this.#client, item.profileIconUrl ?? item.profile_url ?? item.profile ?? '', 'image'),
			_thumbnail: Toolkit.resolveMedia(this.#client, item.thumbnailUrl ?? item.thumbnail ?? '', 'image'),
		}));

		const section = AIRich.newLayout(
			'HScroll',
			reels.map((item) => ({
				reels_url: item.videoUrl ?? item.url ?? '',
				thumbnail_url: item._thumbnail,
				creator: item.username ?? item.title ?? '',
				avatar_url: item._avatar,
				reels_title: item.reels_title ?? item.title ?? '',
				likes_count: item.likes_count ?? item.like ?? 0,
				shares_count: item.shares_count ?? item.share ?? 0,
				view_count: item.view_count ?? item.view ?? 0,
				reel_source: item.reel_source ?? item.source ?? 'IG',
				is_verified: !!(item.is_verified || item.verified),
				__typename: Typenames.REEL,
			}))
		);

		const submessages = [
			{
				messageType: 9,
				contentItemsMetadata: {
					contentType: 1,
					itemsMetadata: reels.map((item) => ({
						reelItem: {
							title: item.username ?? '',
							profileIconUrl: item._avatar,
							thumbnailUrl: item._thumbnail,
							videoUrl: item.videoUrl ?? item.url ?? '',
						},
					})),
				},
			},
		];

		return this._addContent(section, submessages, {
			id,
			replace,
			insertAt,
		});
	}

	addImage(imageUrl, { width, height, status = 3, update_text, resolveUrl = false, id, replace, insertAt } = {}) {
		if (!(typeof imageUrl === 'string' || Buffer.isBuffer(imageUrl) || (Array.isArray(imageUrl) && imageUrl.every((v) => typeof v === 'string' || Buffer.isBuffer(v))))) {
			throw new TypeError('imageUrl must be string | buffer | array of string/buffer');
		}

		const list = Array.isArray(imageUrl)
			? imageUrl.map((v) => {
					const url = Toolkit.resolveMedia(this.#client, v, 'image', { resolveUrl });

					return {
						imagePreviewUrl: url,
						imageHighResUrl: url,
						sourceUrl: url,
					};
				})
			: (() => {
					const url = Toolkit.resolveMedia(this.#client, imageUrl, 'image', { resolveUrl });

					return [
						{
							imagePreviewUrl: url,
							imageHighResUrl: url,
							sourceUrl: url,
						},
					];
				})();

		const sections = list.map(({ imagePreviewUrl }) =>
			AIRich.newLayout('Single', {
				media: {
					url: imagePreviewUrl,
					mime_type: 'image/png',
					width,
					height,
				},
				imagine_type: Enums.IMAGINE_TYPE.get(2),
				status: {
					status: Enums.IMAGINE_STATUS.get(status),
					update_text,
				},
				__typename: Typenames.IMAGINE,
			})
		);

		const submessage = {
			messageType: 1,
			gridImageMetadata: {
				gridImageUrl: {
					imagePreviewUrl: list[0]?.imagePreviewUrl,
				},
				imageUrls: list,
			},
		};

		if (id && sections.length !== 1) {
			throw new Error('Cannot assign one id to multiple image sections');
		}

		return this._addContent(sections, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addVideo(videoUrl, { autoFill = true, status = 3, estimatedTime, id, replace, insertAt } = {}) {
		const isObjectVideo = (v) => v && typeof v === 'object' && !Array.isArray(v) && v.url;

		const isValidPrimitive =
			typeof videoUrl === 'string' ||
			Buffer.isBuffer(videoUrl) ||
			isObjectVideo(videoUrl) ||
			(Array.isArray(videoUrl) && videoUrl.every((v) => typeof v === 'string' || Buffer.isBuffer(v) || isObjectVideo(v)));

		if (!isValidPrimitive) {
			throw new TypeError('videoUrl must be string | buffer | object | array');
		}

		const items = Array.isArray(videoUrl) ? videoUrl : [videoUrl];

		const alert = this.createAlert(`${Typenames.IMAGINE} (ANIMATE)`);

		const sections = [];
		const submessages = [];

		for (const item of items) {
			const isObject = isObjectVideo(item);

			const url = isObject ? Toolkit.resolveMedia(this.#client, item.url ?? '', 'video') : Toolkit.resolveMedia(this.#client, item, 'video');

			const bufferPromise = autoFill ? Promise.resolve(url).then((u) => Toolkit.fetchBuffer(u)) : null;

			const file_length = isObject && item.file_length != null ? item.file_length : autoFill ? bufferPromise.then((b) => b?.length ?? 0) : 0;

			const duration =
				isObject && item.duration != null
					? item.duration
					: autoFill
						? bufferPromise.then((b) =>
								Toolkit.getMp4Duration(b, {
									silent: true,
								})
							)
						: 0;

			const thumbnail =
				isObject && item.thumbnail
					? Toolkit.resolveMedia(this.#client, item.thumbnail, 'image', {
							result: 'base64',
							resize: true,
							width: 300,
							height: 300,
						})
					: autoFill
						? bufferPromise?.then((b) =>
								Toolkit.getMp4Preview(b, {
									time: 0,
									result: 'base64',
								})
							)
						: null;

			sections.push(
				AIRich.newLayout('Single', {
					media: {
						url,
						mime_type: isObject ? (item.mime_type ?? 'video/mp4') : 'video/mp4',
						file_length,
						duration,
					},
					imagine_type: Enums.IMAGINE_TYPE.get(1),
					status: {
						status: Enums.IMAGINE_STATUS.get(status),
						estimated_completion_time: estimatedTime != null ? Math.floor((Date.now() + estimatedTime) / 1000) : undefined,
					},
					thumbnail: {
						raw_media: thumbnail,
					},
					__typename: Typenames.IMAGINE,
				})
			);
		}

		if (alert !== undefined) {
			submessages.push(alert);
		}

		if (submessages.length > 1) {
			throw new Error('Video content can only have one submessage');
		}

		return this._addContent(sections, submessages[0], {
			id,
			replace,
			insertAt,
		});
	}

	addCompact(data = {}, { id, replace, insertAt } = {}) {
		if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
			throw new TypeError('Compact items must be an object or an array of objects');
		}

		const items = Array.isArray(data) ? data : [data];

		const primitives = items.map((item) => ({
			__typename: Typenames.COMPACT,
			title: item.title ?? '',
			subtitle: item.subtitle ?? '',
			secondary_subtitle: item.secondary_subtitle ?? item.secondarySubtitle ?? '',
			image: {
				url: Toolkit.resolveMedia(this.#client, item.image_url ?? item.image ?? '', 'image'),
			},
			entity_id: item.entity_id ?? item.id ?? '',
			entity_url: item.entity_url ?? item.url ?? '',
			entity_type: Enums.COMPACT_ENTITY_TYPE.get(item.entity_type ?? 0),
			action_type: Enums.COMPACT_ACTION_TYPE.get(item.action_type ?? 0),
			is_verified: !!(item.is_verified ?? item.verified),
		}));

		const section = AIRich.newLayout(Array.isArray(data) ? 'HScroll' : 'Single', Array.isArray(data) ? primitives : primitives[0]);

		const submessage = this.createAlert(Typenames.COMPACT);

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addProduct(data = {}, { id, replace, insertAt } = {}) {
		if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
			throw new TypeError('Product items must be an object or an array of objects');
		}

		const items = Array.isArray(data) ? data : [data];

		const product = items.map((item) => ({
			title: item.title,
			brand: item.brand,
			price: item.price,
			sale_price: item.sale_price,
			product_url: item.product_url ?? item.url,
			image: {
				url: Toolkit.resolveMedia(this.#client, item.image_url ?? item.image, 'image'),
			},
			additional_images: [
				{
					url: Toolkit.resolveMedia(this.#client, item.icon_url ?? item.icon, 'image'),
				},
			],
			__typename: Typenames.PRODUCT,
		}));

		const section = AIRich.newLayout(Array.isArray(data) ? 'HScroll' : 'Single', Array.isArray(data) ? product : product[0]);

		const submessage = this.createAlert(Typenames.PRODUCT);

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addPost(data = {}, { id, replace, insertAt } = {}) {
		if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
			throw new TypeError('Post items must be an object or an array of objects');
		}

		const posts = Array.isArray(data) ? data : [data];

		const primitives = posts.map((p) => ({
			title: p.title ?? '',
			subtitle: p.subtitle ?? '',
			username: p.username ?? '',
			profile_picture_url: Toolkit.resolveMedia(this.#client, p.profile_picture_url ?? p.profile_url ?? p.profile ?? '', 'image'),
			is_verified: !!(p.is_verified || p.verified),
			thumbnail_url: Toolkit.resolveMedia(this.#client, p.thumbnail_url ?? p.thumbnail ?? '', 'image'),
			post_caption: p.post_caption ?? p.caption ?? '',
			likes_count: p.likes_count ?? p.like ?? 0,
			comments_count: p.comments_count ?? p.comment ?? 0,
			shares_count: p.shares_count ?? p.share ?? 0,
			post_url: p.post_url ?? p.url ?? '',
			post_deeplink: p.post_deeplink ?? p.deeplink ?? '',
			source_app: Enums.SOURCE_APP.get(p.source_app || p.source || 2),
			footer_label: p.footer_label ?? p.footer ?? '',
			footer_icon: Toolkit.resolveMedia(this.#client, p.footer_icon ?? p.icon ?? '', 'image'),
			is_carousel: posts.length > 1,
			orientation: p.orientation ?? 'LANDSCAPE',
			post_type: Enums.POST_TYPE.get(p.post_type ?? 2),
			__typename: Typenames.POST,
		}));

		const section = AIRich.newLayout('HScroll', primitives);

		const submessage = this.createAlert(Typenames.POST);

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addMetadata(text, { id, replace, insertAt } = {}) {
		if (typeof text !== 'string') {
			throw new TypeError('Text must be a string');
		}

		const section = AIRich.newLayout('Single', {
			text,
			__typename: Typenames.METADATA_TEXT,
		});

		const submessage = {
			messageType: 2,
			messageText: text,
		};

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addTip(text, { id, replace, insertAt } = {}) {
		if (typeof text !== 'string') {
			throw new TypeError('Text must be a string');
		}

		const section = AIRich.newLayout('Single', {
			text: 'ⓘ ' + text,
			__typename: Typenames.METADATA_TEXT,
		});

		const submessage = {
			messageType: 2,
			messageText: text,
		};

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addSportsWidget(
	data,
	{
		layout,
		id,
		replace,
		insertAt,
		resolveUrl = true,
		...options
	} = {}
) {
	const isObject = (v) =>
		v &&
		typeof v === 'object' &&
		!Array.isArray(v);

	if (
		!(
			isObject(data) ||
			(Array.isArray(data) &&
				data.every((item) => isObject(item)))
		)
	) {
		throw new TypeError(
			'SportsWidget must be an object or an array of objects'
		);
	}

	const isArray = Array.isArray(data);
	const items = isArray ? data : [data];

	const sections = [];

	for (const item of items) {
		const {
			game_id = '',
			league = 2,
			status = 3,
			start_time_utc_seconds,
			status_detail = '',

			venue = {},
			group = {},
			content = {},

			home_team = {},
			away_team = {},
			home_score = 0,
			away_score = 0,

			...rest
		} = item;

		const homeImage =
			home_team.image ??
			home_team.icon?.image?.url ??
			home_team.icon_url;

		const awayImage =
			away_team.image ??
			away_team.icon?.image?.url ??
			away_team.icon_url;

		const homeFlag =
			home_team.flag ??
			home_team.flag_url ??
			homeImage;

		const awayFlag =
			away_team.flag ??
			away_team.flag_url ??
			awayImage;

		const resolvedHomeFlag = Toolkit.resolveMedia(this.#client, homeFlag, 'image', { resolveUrl });
		const resolvedAwayFlag = Toolkit.resolveMedia(this.#client, awayFlag, 'image', { resolveUrl });

		const finalHomeTeam = {
			...home_team,

			name: home_team.name ?? '',
			abbreviation:
				home_team.abbreviation ?? '',

			icon: {
				...(home_team.icon ?? {}),

				country_code:
					home_team.country_code ??
					home_team.icon?.country_code ??
					'',

				image: {
					...(home_team.icon?.image ?? {}),
					url:
						resolvedHomeFlag ??
						home_team.icon?.image?.url ??
						'',
				},
			},
		};

		const finalAwayTeam = {
			...away_team,

			name: away_team.name ?? '',
			abbreviation:
				away_team.abbreviation ?? '',

			icon: {
				...(away_team.icon ?? {}),

				country_code:
					away_team.country_code ??
					away_team.icon?.country_code ??
					'',

				image: {
					...(away_team.icon?.image ?? {}),
					url:
						resolvedAwayFlag ??
						away_team.icon?.image?.url ??
						'',
				},
			},
		};

		const widget = {
			...rest,

			__typename: Typenames.SPORTS_WIDGET,

			game_id,

			league: Enums.SPORTS_LEAGUE.get(
				league
			),

			status: Enums.SPORTS_GAME_STATUS.get(
				status
			),

			start_time_utc_seconds:
				start_time_utc_seconds ??
				Math.floor(Date.now() / 1000),

			status_detail,

			venue: {
				...venue,
				name: venue.name ?? '',
				city: venue.city ?? '',
				state: venue.state ?? '',
				country: venue.country ?? '',
			},

			group: {
				...group,
				group_name:
					group.group_name ?? '',
				name: group.name ?? '',
			},

			content: {
				...content,

				__typename:
					content.__typename ??
					Typenames.SPORTS_WIDGET_CONTENT,

				home_team: finalHomeTeam,
				away_team: finalAwayTeam,

				home_score,
				away_score,
			},
		};

		sections.push(
			AIRich.newLayout(
				layout ??
					(isArray
						? 'HScroll'
						: 'Single'),
				widget,
				options
			)
		);
	}

	if (id && sections.length !== 1) {
		throw new Error(
			'Cannot assign one id to multiple SportsWidget sections'
		);
	}

	const submessage = this.createAlert(
		Typenames.SPORTS_WIDGET
	);

	return this._addContent(
		sections,
		submessage,
		{
			id,
			replace,
			insertAt,
		}
	);
}

	addFooterAction(data, { layout, id, replace, insertAt, ...options } = {}) {
		if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
			throw new TypeError('Footer action must be an object or an array of objects');
		}

		const isArray = Array.isArray(data);

		const items = isArray ? data : [data];

		const actions = items.map((item) => ({
			__typename: Typenames.FOOTER_ACTION,

			cta_text: item.text ?? item.cta_text ?? '',

			cta_type: Enums.CTA_TYPE.get(item.type ?? item.cta_type ?? 3),

			cta_url: item.url ?? item.cta_url ?? '',
		}));

		const section = AIRich.newLayout(layout ?? (isArray ? 'HScroll' : 'Single'), isArray ? actions : actions[0], options);

		const submessage = this.createAlert(Typenames.FOOTER_ACTION);

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addSuggest(suggestion, { scroll = true, layout, id, replace, insertAt } = {}) {
		if (!(typeof suggestion === 'string' || (Array.isArray(suggestion) && suggestion.every((v) => typeof v === 'string')))) {
			throw new TypeError('Suggestion must be a string or array of strings');
		}

		const suggest = Array.isArray(suggestion)
			? suggestion.map((text) => ({
					prompt_text: text,
					category: Enums.CATEGORY.get(1),
					__typename: Typenames.SUGGESTION_PILL,
				}))
			: [
					{
						prompt_text: suggestion,
						category: Enums.CATEGORY.get(1),
						__typename: Typenames.SUGGESTION_PILL,
					},
				];

		const type = layout ?? (suggest.length === 1 ? 'Single' : scroll ? 'HScroll' : 'ActionRow');

		const section = AIRich.newLayout(type, type === 'Single' ? suggest[0] : suggest);

		const submessage = this.createAlert(Typenames.SUGGESTION_PILL);

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addQuotaUpsell(data, { layout, id, replace, insertAt, ...options } = {}) {
		if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
			throw new TypeError('QuotaUpsell must be an object or an array of objects');
		}

		const isArray = Array.isArray(data);
		const items = isArray ? data : [data];

		const cards = items.map((item) => {
			const { buttons, ...rest } = item;

			return {
				__typename: Typenames.QUOTA_UPSELL,

				...rest,

				...(buttons !== undefined && {
					buttons: buttons.map((button) => ({
						...button,

						cta_text: button.cta_text ?? button.label ?? '',

						cta_type: Enums.CTA_TYPE.get(button.cta_type ?? 4),

						cta_url: button.cta_url ?? '',

						label: button.label ?? button.cta_text ?? '',
					})),
				}),

				__typename: Typenames.QUOTA_UPSELL,
			};
		});

		if (id && cards.length !== 1) {
			throw new Error('Cannot assign one id to multiple QuotaUpsell sections');
		}

		const section = AIRich.newLayout(layout ?? (isArray ? 'HScroll' : 'Single'), isArray ? cards : cards[0], options);

		const submessage = this.createAlert(Typenames.QUOTA_UPSELL);

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	async build(
		jid,
		{ bypassDownload = true, forwarded = true, notification = false, includesUnifiedResponse = true, includesSubmessages = true, quoted, quotedParticipant, messageId, ...options } = {}
	) {
		const forward = forwarded
			? {
					forwardingScore: 1,
					isForwarded: true,
					forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
					forwardOrigin: 4,
				}
			: {};

		const notif = notification
			? {
					sessionTransparencyMetadata: {
						disclaimerText: '~ Ahmad tumbuh kembang',
						hcaId: `hca_${Date.now()}`,
						sessionTransparencyType: 1,
					},
				}
			: {};

		const qObj = quoted
			? {
					stanzaId: quoted?.key?.id || quoted?.id,
					participant: quotedParticipant || quoted?.key?.participant || quoted?.participant || quoted?.key?.remoteJid,
					quotedType: 0,
					quotedMessage: typeof quoted === 'object' && quoted !== null ? (quoted.message ?? quoted) : undefined,
				}
			: {};

		const sections = this._footer
			? [
					...(await Toolkit.waitAllPromises(this._sections)),
					AIRich.newLayout('Single', {
						text: this._footer,
						__typename: Typenames.TEXT,
					}),
				]
			: [...(await Toolkit.waitAllPromises(this._sections))];

		if (this._dynamic) {
			this.refreshResponseId();
			this.refreshBotResponseId();
		}

		return generateWAMessageFromContent(
			jid,
			{
				messageContextInfo: {
					deviceListMetadata: {},
					deviceListMetadataVersion: 2,
					botMetadata: {
						messageDisclaimerText: this._title,
						...notif,
						verificationMetadata: AIRich.generateVerificationMetadata(),
						botResponseId: this._botResponseId,
					},
				},
				...this._extraPayload,
				botForwardedMessage: {
					message: {
						richResponseMessage: {
							messageType: 1,
							submessages: includesSubmessages ? await Toolkit.waitAllPromises(this._submessages) : [],
							unifiedResponse: {
								data: includesUnifiedResponse ? Buffer.from(Toolkit.stringifyEscaped({ response_id: this._responseId, sections })).toString('base64') : '',
							},
							contextInfo: {
								...forward,
								...qObj,
								...this._contextInfo,
							},
						},
					},
				},
			},
			{ messageId: messageId || generateMessageIDV2(), ...options }
		);
	}

	async buildEdit(targetJid, targetId, { msg, messageId, ...options } = {}) {
		if (!msg) {
			msg = (await this.build(targetJid, options)).message;
		}

		const editedMessage = msg;

		if (!editedMessage) {
			throw new Error('buildEdit: msg does not contain botForwardedMessage');
		}

		return generateWAMessageFromContent(
			targetJid,
			{
				botForwardedMessage: {
					message: {
						protocolMessage: {
							key: {
								remoteJid: targetJid,
								fromMe: true,
								id: targetId,
							},
							type: 14,
							editedMessage,
						},
					},
				},
			},
			{ messageId: messageId || generateMessageIDV2(), ...options }
		);
	}

	async sendEdit(jid, id, { msg, messageId, additionalNodes = [], ...options } = {}) {
		jid = jid ?? this._lastMessageKey?.remoteJid;
		id = id ?? this._lastMessageKey?.id;

		if (!jid) {
			throw new Error('JID is required');
		}

		if (!id) {
			throw new Error('Message id is required');
		}

		const msgEdit = await this.buildEdit(jid, id, {
			msg,
			messageId: messageId || generateMessageIDV2(),
			...options,
		});

		await this.#client.relayMessage(jid, msgEdit.message, {
			messageId: msgEdit.key.id,
			additionalNodes,
		});

		return msgEdit;
	}

	async send(jid, { bypassDownload = true, forwarded = true, notification = false, includesUnifiedResponse = true, includesSubmessages = true, messageId, additionalNodes = [], ...options } = {}) {
		const msg = await this.build(jid, {
			forwarded,
			notification,
			includesUnifiedResponse,
			includesSubmessages,
			messageId,
			...options,
		});

		await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes,
			...options,
		});

		if (includesUnifiedResponse && bypassDownload) {
			await this.sendEdit(jid, msg.key.id, {
				msg: msg.message,
			});
		}

		this._lastMessageKey = msg.key;

		return msg;
	}

	static tokenizer(code, lang = 'javascript') {
		const keywordsMap = {
			javascript: new Set([
				'break',
				'case',
				'catch',
				'continue',
				'debugger',
				'delete',
				'do',
				'else',
				'finally',
				'for',
				'function',
				'if',
				'in',
				'instanceof',
				'new',
				'return',
				'switch',
				'this',
				'throw',
				'try',
				'typeof',
				'var',
				'void',
				'while',
				'with',
				'true',
				'false',
				'null',
				'undefined',
				'class',
				'const',
				'let',
				'super',
				'extends',
				'export',
				'import',
				'yield',
				'static',
				'constructor',
				'async',
				'await',
				'get',
				'set',
			]),

			typescript: new Set([
				'abstract',
				'any',
				'as',
				'asserts',
				'bigint',
				'boolean',
				'declare',
				'enum',
				'implements',
				'infer',
				'interface',
				'is',
				'keyof',
				'module',
				'namespace',
				'never',
				'readonly',
				'require',
				'number',
				'object',
				'override',
				'private',
				'protected',
				'public',
				'satisfies',
				'string',
				'symbol',
				'type',
				'unknown',
				'using',
				'from',
				'break',
				'case',
				'catch',
				'continue',
				'do',
				'else',
				'finally',
				'for',
				'function',
				'if',
				'new',
				'return',
				'switch',
				'this',
				'throw',
				'try',
				'var',
				'void',
				'while',
				'class',
				'const',
				'let',
				'extends',
				'import',
				'export',
				'async',
				'await',
			]),

			python: new Set([
				'False',
				'None',
				'True',
				'and',
				'as',
				'assert',
				'async',
				'await',
				'break',
				'class',
				'continue',
				'def',
				'del',
				'elif',
				'else',
				'except',
				'finally',
				'for',
				'from',
				'global',
				'if',
				'import',
				'in',
				'is',
				'lambda',
				'nonlocal',
				'not',
				'or',
				'pass',
				'raise',
				'return',
				'try',
				'while',
				'with',
				'yield',
			]),

			java: new Set([
				'abstract',
				'assert',
				'boolean',
				'break',
				'byte',
				'case',
				'catch',
				'char',
				'class',
				'const',
				'continue',
				'default',
				'do',
				'double',
				'else',
				'enum',
				'extends',
				'final',
				'finally',
				'float',
				'for',
				'goto',
				'if',
				'implements',
				'import',
				'instanceof',
				'int',
				'interface',
				'long',
				'native',
				'new',
				'package',
				'private',
				'protected',
				'public',
				'return',
				'short',
				'static',
				'strictfp',
				'super',
				'switch',
				'synchronized',
				'this',
				'throw',
				'throws',
				'transient',
				'try',
				'void',
				'volatile',
				'while',
			]),

			golang: new Set([
				'break',
				'case',
				'chan',
				'const',
				'continue',
				'default',
				'defer',
				'else',
				'fallthrough',
				'for',
				'func',
				'go',
				'goto',
				'if',
				'import',
				'interface',
				'map',
				'package',
				'range',
				'return',
				'select',
				'struct',
				'switch',
				'type',
				'var',
			]),

			c: new Set([
				'auto',
				'break',
				'case',
				'char',
				'const',
				'continue',
				'default',
				'do',
				'double',
				'else',
				'enum',
				'extern',
				'float',
				'for',
				'goto',
				'if',
				'int',
				'long',
				'register',
				'return',
				'short',
				'signed',
				'sizeof',
				'static',
				'struct',
				'switch',
				'typedef',
				'union',
				'unsigned',
				'void',
				'volatile',
				'while',
			]),

			cpp: new Set([
				'alignas',
				'alignof',
				'and',
				'auto',
				'bool',
				'break',
				'case',
				'catch',
				'class',
				'const',
				'constexpr',
				'continue',
				'delete',
				'do',
				'double',
				'else',
				'enum',
				'explicit',
				'export',
				'extern',
				'false',
				'float',
				'for',
				'friend',
				'if',
				'inline',
				'int',
				'long',
				'mutable',
				'namespace',
				'new',
				'noexcept',
				'nullptr',
				'operator',
				'private',
				'protected',
				'public',
				'return',
				'short',
				'signed',
				'sizeof',
				'static',
				'struct',
				'switch',
				'template',
				'this',
				'throw',
				'true',
				'try',
				'typedef',
				'typename',
				'union',
				'unsigned',
				'using',
				'virtual',
				'void',
				'while',
			]),

			php: new Set([
				'abstract',
				'and',
				'array',
				'as',
				'break',
				'callable',
				'case',
				'catch',
				'class',
				'clone',
				'const',
				'continue',
				'declare',
				'default',
				'do',
				'echo',
				'else',
				'elseif',
				'empty',
				'enddeclare',
				'endfor',
				'endforeach',
				'endif',
				'endswitch',
				'endwhile',
				'extends',
				'final',
				'finally',
				'fn',
				'for',
				'foreach',
				'function',
				'global',
				'goto',
				'if',
				'implements',
				'include',
				'include_once',
				'instanceof',
				'interface',
				'match',
				'namespace',
				'new',
				'null',
				'or',
				'private',
				'protected',
				'public',
				'require',
				'require_once',
				'return',
				'static',
				'switch',
				'throw',
				'trait',
				'try',
				'use',
				'var',
				'while',
				'yield',
			]),

			rust: new Set([
				'as',
				'break',
				'const',
				'continue',
				'crate',
				'else',
				'enum',
				'extern',
				'false',
				'fn',
				'for',
				'if',
				'impl',
				'in',
				'let',
				'loop',
				'match',
				'mod',
				'move',
				'mut',
				'pub',
				'ref',
				'return',
				'self',
				'Self',
				'static',
				'struct',
				'super',
				'trait',
				'true',
				'type',
				'unsafe',
				'use',
				'where',
				'while',
			]),

			html: new Set([
				'html',
				'head',
				'body',
				'div',
				'span',
				'p',
				'a',
				'img',
				'video',
				'audio',
				'script',
				'style',
				'link',
				'meta',
				'form',
				'input',
				'button',
				'table',
				'tr',
				'td',
				'th',
				'ul',
				'ol',
				'li',
				'section',
				'article',
				'header',
				'footer',
				'nav',
				'main',
			]),

			bash: new Set([
				'if',
				'then',
				'else',
				'elif',
				'fi',
				'for',
				'while',
				'do',
				'done',
				'case',
				'esac',
				'function',
				'in',
				'select',
				'until',
				'break',
				'continue',
				'return',
				'export',
				'readonly',
				'local',
				'declare',
			]),

			markdown: new Set(['#', '##', '###', '####', '#####', '######']),
		};

		if (!lang || lang === 'txt' || lang === 'text' || lang === 'plaintext') {
			return {
				codeBlock: [
					{
						codeContent: code,
						highlightType: 0,
					},
				],
				unified_codeBlock: [
					{
						content: code,
						type: 'DEFAULT',
					},
				],
			};
		}

		const TYPE_MAP = {
			0: 'DEFAULT',
			1: 'KEYWORD',
			2: 'METHOD',
			3: 'STR',
			4: 'NUMBER',
			5: 'COMMENT',
		};

		const keywords = keywordsMap[lang.toLowerCase()] || new Set();
		const tokens = [];

		let i = 0;

		const push = (content, type) => {
			if (!content) return;

			const last = tokens[tokens.length - 1];

			if (last && last.highlightType === type) {
				last.codeContent += content;
			} else {
				tokens.push({
					codeContent: content,
					highlightType: type,
				});
			}
		};

		const isIdentifier = (char) => {
			switch (lang.toLowerCase()) {
				case 'css':
					return /[a-zA-Z0-9_$-]/.test(char);

				case 'html':
					return /[a-zA-Z0-9_$:-]/.test(char);

				default:
					return /[a-zA-Z0-9_$]/.test(char);
			}
		};

		while (i < code.length) {
			const c = code[i];

			if (/\s/.test(c)) {
				let s = i;

				while (i < code.length && /\s/.test(code[i])) {
					i++;
				}

				push(code.slice(s, i), 0);
				continue;
			}

			if ((c === '/' && code[i + 1] === '/') || (c === '#' && ['python', 'bash'].includes(lang))) {
				let s = i;

				while (i < code.length && code[i] !== '\n') {
					i++;
				}

				push(code.slice(s, i), 5);
				continue;
			}

			if (c === '"' || c === "'" || c === '`') {
				let s = i;
				const q = c;

				i++;

				while (i < code.length) {
					if (code[i] === '\\' && i + 1 < code.length) {
						i += 2;
					} else if (code[i] === q) {
						i++;
						break;
					} else {
						i++;
					}
				}

				push(code.slice(s, i), 3);
				continue;
			}

			if (/[0-9]/.test(c)) {
				let s = i;

				while (i < code.length && /[0-9._]/.test(code[i])) {
					i++;
				}

				push(code.slice(s, i), 4);
				continue;
			}

			if (/[a-zA-Z_$]/.test(c)) {
				let s = i;

				while (i < code.length && isIdentifier(code[i])) {
					i++;
				}

				const word = code.slice(s, i);

				let type = 0;

				if (keywords.has(word)) {
					type = 1;
				} else if (lang === 'css') {
					let j = i;

					while (j < code.length && /\s/.test(code[j])) {
						j++;
					}

					if (code[j] === ':') {
						type = 1;
					}
				} else if (lang === 'html') {
					let p = s - 1;

					while (p >= 0 && /\s/.test(code[p])) {
						p--;
					}

					if (code[p] === '<' || (code[p] === '/' && code[p - 1] === '<')) {
						type = 1;
					}
				}

				if (type === 0) {
					let j = i;

					while (j < code.length && /\s/.test(code[j])) {
						j++;
					}

					if (code[j] === '(') {
						type = 2;
					}
				}

				push(word, type);
				continue;
			}

			push(c, 0);
			i++;
		}

		return {
			codeBlock: tokens,
			unified_codeBlock: tokens.map((t) => ({
				content: t.codeContent,
				type: TYPE_MAP[t.highlightType],
			})),
		};
	}

	static toTableMetadata(arr, { hyperlink = true, citation = true, latex = true } = {}) {
		if (!Array.isArray(arr) || !arr.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'))) {
			throw new TypeError('Table must be a nested array of strings');
		}

		const [header, ...rows] = arr;

		const maxLen = Math.max(header.length, ...rows.map((r) => r.length));

		const normalize = (r) => [...r, ...Array(maxLen - r.length).fill('')];

		const unified_rows = [
			{
				is_header: true,
				cells: normalize(header),
			},
			...rows.map((r) => ({
				is_header: false,
				cells: normalize(r),
			})),
		].map((row) => {
			const markdown_cells = row.cells.map((cell) => {
				const extracted = Toolkit.extractIE(cell, { hyperlink, citation, latex });

				return {
					text: extracted.text,
					...(extracted.inline_entities.length ? { inline_entities: extracted.inline_entities } : {}),
				};
			});

			return {
				...row,
				...(markdown_cells.some((c) => c.inline_entities?.length) ? { markdown_cells } : {}),
			};
		});

		const rowsMeta = unified_rows.map((r) => ({
			items: r.cells,
			...(r.is_header ? { isHeading: true } : {}),
		}));

		return {
			title: '',
			rows: rowsMeta,
			unified_rows,
		};
	}

	static generateVerificationMetadata() {
		const signatureMaterial = Buffer.from(
			`\u004E\u0049\u0058\u0045\u004C\u002E\u004D\u0065\u0073\u0073\u0061\u0067\u0065\u0042\u0075\u0069\u006C\u0064\u0065\u0072\u0056${VERSION}\u002D\u0056\u0065\u0072\u0069\u0066\u0069\u0063\u0061\u0074\u0069\u006F\u006E\u0053\u0069\u0067\u006E\u0061\u0074\u0075\u0072\u0065\u002E\u004D\u0065\u0074\u0061\u0064\u0061\u0074\u0061`
		);

		const certificateMaterial = Buffer.from(
			`\u004E\u0049\u0058\u0045\u004C\u002E\u004D\u0065\u0073\u0073\u0061\u0067\u0065\u0042\u0075\u0069\u006C\u0064\u0065\u0072\u0056${VERSION}\u002D\u0043\u0065\u0072\u0074\u0069\u0066\u0069\u0063\u0061\u0074\u0065\u0043\u0068\u0061\u0069\u006E\u002E\u004D\u0065\u0074\u0061\u0064\u0061\u0074\u0061`
		);

		const signature = Buffer.concat([signatureMaterial, crypto.randomBytes(64 - signatureMaterial.length)]).toString('base64');

		const certificateChain = [
			Buffer.concat([certificateMaterial, crypto.randomBytes(684 - certificateMaterial.length)]).toString('base64'),

			Buffer.concat([certificateMaterial, crypto.randomBytes(892 - certificateMaterial.length)]).toString('base64'),
		];

		return {
			proofs: [
				{
					version: 1,
					useCase: 1,
					signature,
					certificateChain,
				},
			],
		};
	}

	static newLayout(name, data, extra = {}) {
		const KEY = 0x5a;
		const decode = (b64) => Buffer.from([...Buffer.from(b64, 'base64')].map((b) => b ^ KEY)).toString('utf8');

		const layout = {
			Single: 'FxgUMyI/NgkzND02PxY7IzUvLrXi07Xi1bjb/rXi37ja0bXi3bXi1bXi3w==',
			Grid: 'FxgUMyI/Nh0oMz4WOyM1Ly614eW14tK14tW42/q14te14tm14tE=',
			HScroll: 'FxgUMyI/NhIJOSg1NjYWOyM1Ly642/q14tu14t+42/u42/u14tm14tY=',
			VStack: 'FxgUMyI/NgwJLjs5MRY7IzUvLrja0bjb+7Xi3Lja0bjb+rja1rjb+A==',
			ActionRow: 'FxgUMyI/Nhs5LjM1NAg1LRY7IzUvLrXi2LXi3bXi1rXi0Lja0bXi2bXi1Ljb+A==',
			AddonAction: 'FxgUMyI/Nhs+PjU0GzkuMzU0FjsjNS8uteLWuNv7teLZteLYuNrRuNv4uNrRuNrR',
			FlexibleCountGrid: 'FxgUMyI/Nhw2PyIzODY/GTUvNC4dKDM+FjsjNS8uuNv+teLcuNv4teLZteLbuNv6teLV',
			RichListItem: 'FxgUMyI/NggzOTIWMykuEy4/NxY7IzUvLrXi3Lja0bja0bjb+rja0bjb+bXi3rjb+w==',
			MultipleResponse: 'FxgUMyI/NhcvNi4zKjY/CD8pKjU0KT8WOyM1Ly614tq42/u42tG14te14ti14t242/k=',
		};

		const typename = layout[name] ? decode(layout[name]) : `GenAI${name}LayoutViewModel`;

		return {
			__typename: Buffer.from('TUJOaXhlbEFobWFkUG9waW9v', 'base64').toString(),
			...extra,
			view_model: {
				[Array.isArray(data) ? 'primitives' : 'primitive']: data,
				__typename: typename,
			},
		};
	}

	_makeNode(id, section, submessage) {
		return { id: id ?? null, section: section ?? null, submessage: submessage ?? null };
	}

	_registerId(node, id) {
		if (id === undefined || id === null || id === '') return;

		if (typeof id !== 'string') {
			throw new ContentValidationError('Item id must be a string', { id });
		}

		if (this._idIndex.has(id)) {
			throw new DuplicateIdError(id);
		}

		node.id = id;
		this._idIndex.set(id, node);
	}

	_unregisterId(node) {
		if (node.id && this._idIndex.get(node.id) === node) {
			this._idIndex.delete(node.id);
		}
	}

	hasId(id) {
		return typeof id === 'string' && this._idIndex.has(id);
	}

	getIds() {
		return [...this._idIndex.keys()];
	}

	peek(id) {
		const node = this._idIndex.get(id);

		if (!node) return null;

		return {
			id: node.id,
			section: node.section,
			submessage: node.submessage,
		};
	}

	assignId(index, id) {
		if (!Number.isInteger(index) || index < 0 || index >= this._nodes.length) {
			throw new InvalidTargetError(`Node index ${index} is out of range (0-${this._nodes.length - 1})`, { index });
		}

		const node = this._nodes[index];

		if (node.id) {
			throw new AIRichError(`Node at index ${index} already has id "${node.id}"`, 'ALREADY_HAS_ID', { index, id: node.id });
		}

		this._registerId(node, id);

		return this;
	}

	_getNode(id) {
		if (typeof id !== 'string' || !id) {
			throw new ContentValidationError('Item id must be a non-empty string', { id });
		}

		const node = this._idIndex.get(id);

		if (!node) {
			throw new ItemNotFoundError(id, this.getIds());
		}

		return node;
	}

	_resolveTarget(target) {
		if (Array.isArray(target)) {
			if (target.length < 1 || target.length > 2) {
				throw new ContentValidationError('Target must be id or [id, offset]', { target });
			}

			const [id, offset = 0] = target;

			if (typeof id !== 'string' || !id) {
				throw new ContentValidationError('Target id must be a non-empty string', { target });
			}

			if (!Number.isInteger(offset)) {
				throw new ContentValidationError('Offset must be an integer', { target });
			}

			return { id, offset };
		}

		if (typeof target !== 'string' || !target) {
			throw new ContentValidationError('Target must be a non-empty id or [id, offset]', { target });
		}

		return { id: target, offset: 0 };
	}

	_resolveNodeIndex(target) {
		const { id, offset } = this._resolveTarget(target);
		const node = this._getNode(id);
		const baseIndex = this._nodes.indexOf(node);

		if (baseIndex === -1) {
			throw new InvalidTargetError(`Item id "${id}" is registered but not present in the node list (internal desync)`, { id });
		}

		const index = baseIndex + offset;

		if (index < 0 || index >= this._nodes.length) {
			throw new InvalidTargetError(`Target "${id}" with offset ${offset} resolves to index ${index}, which is out of range (0-${this._nodes.length - 1})`, { id, offset, index });
		}

		return { id, offset, baseIndex, index };
	}

	_validateSections(section) {
		const items = Array.isArray(section) ? section : [section];

		if (!items.length) {
			throw new ContentValidationError('At least one section is required');
		}

		for (const item of items) {
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				throw new ContentValidationError('Sections must be plain objects');
			}
		}

		return items;
	}

	_validateSubmessages(submessage) {
		if (submessage === undefined || submessage === null) {
			return [];
		}

		const items = Array.isArray(submessage) ? submessage : [submessage];

		for (const item of items) {
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				throw new ContentValidationError('Submessages must be plain objects');
			}
		}

		return items;
	}

	_pairSubmessages(sections, submessages) {
		const n = sections.length;
		const m = submessages.length;

		if (m === 0) return sections.map(() => null);
		if (m === 1) return sections.map((_, i) => (i === 0 ? submessages[0] : null));
		if (m === n) return submessages;

		throw new ContentValidationError(`Cannot pair ${m} submessage(s) with ${n} section(s): expected 0, 1, or ${n}`, { sectionCount: n, submessageCount: m });
	}

	_addContent(section, submessage, { id, replace, insertAt } = {}) {
		const hasReplace = replace !== undefined && replace !== null && replace !== '';

		const hasInsertAt = insertAt !== undefined && insertAt !== null && insertAt !== '';

		if (hasReplace && hasInsertAt) {
			throw new ContentValidationError('replace and insertAt cannot be used together');
		}

		const sections = this._validateSections(section);
		const submessages = this._validateSubmessages(submessage);

		if (!sections.length) {
			throw new ContentValidationError('At least one section is required');
		}

		if (id !== undefined && id !== null && id !== '' && sections.length !== 1) {
			throw new ContentValidationError('One id can only be assigned to one node', {
				id,
				sectionCount: sections.length,
			});
		}

		if (submessages.length && submessages.length !== sections.length && submessages.length !== 1) {
			throw new ContentValidationError('Section and submessage count must match');
		}

		const pairedSubmessages = sections.map((_, index) => {
			if (!submessages.length) return undefined;

			return submessages.length === 1 ? submessages[0] : submessages[index];
		});

		if (id && this._idIndex.has(id) && !(hasReplace && this._resolveTarget(replace)?.id === id)) {
			throw new DuplicateIdError(id);
		}

		const newNodes = sections.map((currentSection, index) => {
			return this._makeNode(index === 0 ? id : null, currentSection, pairedSubmessages[index]);
		});

		if (hasReplace) {
			if (newNodes.length !== 1) {
				throw new ContentValidationError('replace only supports adding exactly one node');
			}

			const target = this._resolveNodeIndex(replace);

			if (!target) {
				throw new ContentValidationError('Target node could not be resolved');
			}

			const oldNode = this._nodes[target.index];
			const newNode = newNodes[0];

			if (!newNode.id && oldNode?.id) {
				newNode.id = oldNode.id;
			}

			this._unregisterId(oldNode);

			this._nodes.splice(target.index, 1, newNode);

			if (newNode.id) {
				this._idIndex.set(newNode.id, newNode);
			}

			return this;
		}

		if (hasInsertAt) {
			const target = this._resolveNodeIndex(insertAt);

			if (!target) {
				throw new ContentValidationError('Target node could not be resolved');
			}

			const insertIndex = target.offset < 0 ? target.index : target.index + 1;

			this._nodes.splice(insertIndex, 0, ...newNodes);

			for (const node of newNodes) {
				if (node.id) {
					this._idIndex.set(node.id, node);
				}
			}

			return this;
		}

		this._nodes.push(...newNodes);

		for (const node of newNodes) {
			if (node.id) {
				this._idIndex.set(node.id, node);
			}
		}

		return this;
	}

	addSection(section, options = {}) {
		return this._addContent(section, undefined, options);
	}

	addSubmessage(submessage, options = {}) {
		const items = this._validateSubmessages(submessage);

		if (!items.length) {
			throw new ContentValidationError('At least one submessage is required');
		}

		return this._addContent(undefined, items, options);
	}

	delete(target) {
		const { index } = this._resolveNodeIndex(target);
		const [oldNode] = this._nodes.splice(index, 1);

		this._unregisterId(oldNode);

		return this;
	}

	get _sections() {
		return this._nodes.filter((n) => n.section !== null).map((n) => n.section);
	}

	get _submessages() {
		return this._nodes.filter((n) => n.submessage !== null).map((n) => n.submessage);
	}

	get sections() {
		return this._sections;
	}

	get items() {
		return this._sections.flatMap((section) => {
			const vm = section?.view_model;

			if (Array.isArray(vm?.primitives)) {
				return vm.primitives;
			}

			if (vm?.primitive) {
				return [vm.primitive];
			}

			return [];
		});
	}
}

export default { VERSION, BaseBuilder, Button, ButtonV2, Carousel, AIRich, Toolkit, Typenames, Enums };
export { VERSION, BaseBuilder, Button, ButtonV2, Carousel, AIRich, Toolkit, Typenames, Enums };
