import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findGuideFromParam, loadGuideText } from './GuideLoadModal.js';

test('deep links resolve channel IDs and paths with channel display names', async t => {
    const path = 'rs3-full-boss-guides/araxxor/araxxor.txt';
    t.mock.method(globalThis, 'fetch', async () => ({
        ok: true,
        json: async () => [{ id: '123456789', name: 'Araxxor', path }]
    }));

    for (const param of ['123456789', path, path.replace(/\.txt$/, ''), encodeURIComponent(path)]) {
        assert.deepEqual(await findGuideFromParam(param), {
            name: 'Araxxor', path,
            url: `https://raw.githubusercontent.com/pvme/pvme-guides/master/${path}`
        });
    }
    assert.equal(await findGuideFromParam('unknown-channel'), null);
});

test('deep links open repository files absent from the channel list and load them through the review API', async t => {
    const path = 'rs3-full-boss-guides/araxxor/araxxor-melee.txt';
    t.mock.method(globalThis, 'fetch', async url => {
        if (url.endsWith('/channels.json')) {
            return { ok: true, json: async () => [] };
        }
        const request = new URL(url);
        assert.equal(request.pathname, '/guides/load');
        assert.equal(request.searchParams.get('path'), path);
        assert.equal(request.searchParams.get('source'), 'auto');
        return { ok: true, json: async () => ({ originalText: 'Guide content' }) };
    });

    const link = new URL('https://pvme.io/guide-editor/?id=rs3-full-boss-guides%2Faraxxor%2Faraxxor-melee.txt');
    for (const param of [link.searchParams.get('id'), encodeURIComponent(path), `/${path}/`, path.replace(/\.txt$/, '')]) {
        const guide = await findGuideFromParam(param);
        assert.deepEqual(guide, {
            name: 'araxxor-melee', path,
            url: `https://raw.githubusercontent.com/pvme/pvme-guides/master/${path}`
        });
        assert.equal((await loadGuideText(guide)).originalText, 'Guide content');
    }
});

test('empty and malformed repository paths do not open the load modal', async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Invalid paths should not fetch channels'));
    for (const param of ['', null, '/', '../guide.txt', 'guides/../guide.txt', 'guides//guide.txt', 'guides/./guide.txt', 'guides/guide.txt?raw=1', 'guides\\nested/guide.txt', 'https://github.com/pvme/pvme-guides/blob/master/guide.txt']) {
        assert.equal(await findGuideFromParam(param), null);
    }
});

test('live guide loading falls back to raw GitHub when the guide API is unreachable', async t => {
    const guide = {
        path: 'rs3-full-boss-guides/araxxor/araxxor-melee.txt',
        url: 'https://raw.githubusercontent.com/pvme/pvme-guides/master/rs3-full-boss-guides/araxxor/araxxor-melee.txt'
    };
    for (const failure of ['network', 502, 503, 504]) {
        const calls = [];
        const mock = t.mock.method(globalThis, 'fetch', async url => {
            calls.push(url);
            if (url === guide.url) return { ok: true, text: async () => 'Live guide\r\n' };
            if (failure === 'network') throw new TypeError('Failed to fetch');
            return { ok: false, status: failure, json: async () => ({ error: 'fetch failed' }) };
        });
        for (const source of ['auto', 'master']) {
            const loaded = await loadGuideText(guide, source);
            assert.equal(loaded.originalText, 'Live guide\r\n');
            assert.equal(loaded.source, 'master');
            assert.equal(loaded.branch, 'master');
            assert.match(loaded.notice, /Submitted updates could not be checked/);
        }
        assert.equal(calls.filter(url => url === guide.url).length, 2);
        mock.mock.restore();
    }
});

test('submitted review loads and non-availability errors never fall back to the live guide', async t => {
    const guide = { path: 'guides/test.txt', url: 'https://raw.githubusercontent.com/pvme/pvme-guides/master/guides/test.txt' };
    for (const [source, status] of [['review', 502], ['auto', 404], ['auto', 401], ['master', 429]]) {
        const mock = t.mock.method(globalThis, 'fetch', async url => {
            assert.notEqual(url, guide.url);
            return { ok: false, status, json: async () => ({ error: 'Load failed' }) };
        });
        await assert.rejects(loadGuideText(guide, source), error => error.status === status);
        mock.mock.restore();
    }
});
