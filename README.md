Editor for [PVME Discord](https://discord.gg/6djqFVN) guides:

[![Image from Gyazo](https://i.gyazo.com/5ec9f4f0fe50544067d36a24af37ef45.gif)](https://gyazo.com/5ec9f4f0fe50544067d36a24af37ef45)

## Development

**install packages**

```
npm install
```

**Live development server**

```
npm run dev
```

## Pipeline

```USER INPUT
   ↓
CodeMirror (stores.text)
   ↓
parseMessages()
   ↓
messages[] = {
    content,
    embed,
    attachments,
    lineMap  ← authoritative
}
   ↓
DiscordView.svelte
   ↓
<Message lineMap={...} lineOffset={...} />
   ↓
DOM .pvme-line (final truth)
```

## Compatibility Notice

This project currently depends on a **specific, stable stack** due to breaking changes in Svelte 5 and the latest vite-plugin-svelte releases.

You **must** use the versions below:

- `"svelte": "5.37.0"`
- `"@sveltejs/vite-plugin-svelte": "3.0.2"`

### Why these versions?

Newer versions of vite-plugin-svelte (4.x and above) assume the new Svelte 5 component API and **disable legacy `new App()` mounting**, even when `runes: false` and `compatibility.componentApi: 4` are configured.

This causes:
- `<script>` in `.svelte` files to run
- but the component **never mounts**
- `onMount` **never fires**
- no DOM is rendered
- no errors are thrown

Downgrading to vite-plugin-svelte `3.0.2` restores correct legacy behaviour and allows this project to keep using:
- the Svelte 3/4-style component API
- `new App()` root instantiation
- standard reactivity
- CodeMirror integration without runes

### Summary

Do **not** upgrade Svelte or vite-plugin-svelte past these versions unless you plan to fully migrate the project to Svelte 5 runes and the new `App.mount()` API.
