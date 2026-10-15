import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "vite";
import { getPresetEmbedUrl } from "./presetEmbeds.js";

const id = "563964a0-2ddc-47ec-966b-a3f5a3876e37";
const base = `https://pvme.io/preset-maker-storage/embeds/${id}`;
const version = "7079b8d4247aedf6d8912b9c1024ac898a7d62bce6f29164d1d8a32deb6660c0";

test("preserves layout and cache version in new and legacy URLs", () => {
    for (const layout of ["7x4", "4x7"]) {
        const embed = `${base}/${layout}/?v=${version}`;
        assert.equal(getPresetEmbedUrl(embed), embed);
        for (const separator of ["?", "&"]) {
            assert.equal(
                getPresetEmbedUrl(`https://presets.pvme.io/?id=${id}${separator}layout=${layout}&v=${version}`),
                embed
            );
        }
    }
    assert.equal(getPresetEmbedUrl(`https://presets.pvme.io?id=${id}`), `${base}/7x4/`);
    assert.equal(getPresetEmbedUrl(`${base}/4x7`), `${base}/4x7/`);
});

test("rejects unrelated, malformed, and unsupported preset URLs", () => {
    for (const url of [
        "not a URL",
        `https://example.com/?id=${id}`,
        `https://presets.pvme.io.evil.test/?id=${id}`,
        "https://presets.pvme.io/?id=",
        `https://presets.pvme.io/?id=${id}&layout=9x9`,
        `https://presets.pvme.io/?id=${id}%2Fother`,
        `${base}/9x9/`,
        `ftp://presets.pvme.io/?id=${id}`
    ]) assert.equal(getPresetEmbedUrl(url), null, url);
});

test("captures new and legacy Markdown preset links while respecting embed suppression", async () => {
    const bundle = await build({
        configFile: false,
        logLevel: "silent",
        publicDir: false,
        build: {
            write: false,
            minify: false,
            lib: { entry: "src/markdown.js", formats: ["es"] }
        }
    });
    const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(file => file.isEntry).code;
    const { default: markdownToHTML } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
    for (const url of [
        `${base}/7x4/?v=${version}`,
        `${base}/4x7/?v=${version}`,
        `https://presets.pvme.io/?id=${id}?layout=4x7`,
        `https://presets.pvme.io/?id=${id}&layout=7x4`
    ]) {
        assert.deepEqual(markdownToHTML(`[Preset](${url})`).messageAttachments, [url]);
        assert.deepEqual(markdownToHTML(url).messageAttachments, [url]);
        assert.deepEqual(markdownToHTML(`[Preset](<${url}>)`).messageAttachments, []);
    }
    assert.deepEqual(markdownToHTML("[Other](https://example.com/)").messageAttachments, []);
});
