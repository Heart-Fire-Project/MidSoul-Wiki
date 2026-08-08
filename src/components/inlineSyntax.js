export const INLINE = /(<Label\b[^>]*>[\s\S]*?<\/Label>|<span\b[^>]*>[\s\S]*?<\/span>|<strong\b[^>]*>[\s\S]*?<\/strong>|!\[[^\]]*\]\([^)]*\)|\*\*[\s\S]*?\*\*|~~[\s\S]*?~~|`[^`]*`|\*[^*]+\*|\[[^\]]*\]\([^)]*\)|<br\s*\/?>|(?<!\\)\$(?!\$)(?!\d+\$)[^$\n]+?\$(?!\$))/g;

export function attrsOf(open) {
	const attrs = {};
	for (const [, key, quote, value] of open.matchAll(/(\w+)=(['"])(.*?)\2/g)) attrs[key] = value;
	return attrs;
}

export function parseStyle(open) {
	const raw = open.match(/style=\{\{([\s\S]*?)\}\}/)?.[1]
		?? open.match(/style=(['"])(.*?)\1/)?.[2]
		?? '';
	const rules = raw.includes(';') ? raw.split(';') : raw.split(/,(?=\s*(?:['"]?[-\w]+['"]?)\s*:)/);
	return Object.fromEntries(rules.map(rule => rule.trim()).filter(Boolean).flatMap(rule => {
		const match = rule.match(/^\s*['"]?([^:'"]+)['"]?\s*:\s*['"]?([\s\S]*?)['"]?\s*$/);
		if (!match) return [];
		const rawKey = match[1].trim();
		const key = rawKey.startsWith('--') ? rawKey : rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
		return [[key, match[2].trim()]];
	}));
}

export function openTagOf(source) {
	return source.slice(0, source.indexOf('>') + 1);
}
