export const requestTargetActions = ['url_rewrite', 'query_mod', 'redirect'];
export const queryPolicies = ['auto', 'preserve', 'replace', 'merge', 'clear'];
const bytes = (value: string) => new TextEncoder().encode(value).length;
const object = (value: any) => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: any, expected: string[]) => object(value) && Object.keys(value).every(key => expected.includes(key));
export function validRequestTarget(target: any) {
    if (typeof target !== 'string' || !target || bytes(target) > 16384 || /[\x00-\x20\x7f-\uffff\\#]/.test(target) || target.startsWith('//')) return false;
    if (target.startsWith('/') || target.startsWith('?')) return true;
    try {
        const url = new URL(target);
        return /^https?:\/\//i.test(target) && ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.hostname.includes('..')
            && !url.username && !url.password && url.port !== '0';
    } catch { return false; }
}
export function normalizeRequestTarget(action: string, config: any, scope: string) {
    if (!requestTargetActions.includes(action)) return config;
    if (scope !== 'request' || !object(config)) throw Error('URL, Query and HTTP redirect actions support request headers only.');
    if (action === 'query_mod') {
        if (!keys(config, ['operations']) || !Array.isArray(config.operations) || !config.operations.length || config.operations.length > 128)
            throw Error('Enter 1–128 Query operations.');
        const operations = config.operations.map((item: any) => {
            const allowed = item?.op === 'clear' ? ['op'] : item?.op === 'remove' ? ['op', 'key'] : ['op', 'key', 'value'];
            if (!keys(item, allowed) || !['set', 'append', 'remove', 'clear'].includes(item.op)
                || Object.keys(item).length !== allowed.length || (item.op !== 'clear' && typeof item.key !== 'string')
                || (['set', 'append'].includes(item.op) && typeof item.value !== 'string')
                || bytes((item.key ?? '') + (item.value ?? '')) > 16384) throw Error('Invalid Query operation.');
            return { ...item };
        });
        return { operations };
    }
    if (!keys(config, action === 'redirect' ? ['target', 'query_policy', 'status'] : ['target', 'query_policy'])
        || !validRequestTarget(config.target)) throw Error('Enter a valid encoded HTTP(S) URL, root path or query.');
    const query_policy = config.query_policy === undefined ? 'auto' : config.query_policy;
    if (!queryPolicies.includes(query_policy)) throw Error('Invalid Query policy.');
    const result = { target: config.target, query_policy };
    if (action !== 'redirect') return result;
    const status = config.status === undefined ? 307 : config.status;
    if (![301, 302, 303, 307, 308].includes(status)) throw Error('Invalid HTTP redirect status.');
    return { ...result, status };
}
export const supportsRequestTarget = (capabilities: any) => capabilities?.request_target_rewrite?.supported === true
    && capabilities.request_target_rewrite.version === 1;
