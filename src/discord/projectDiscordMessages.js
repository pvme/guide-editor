/**
 * Project source/authoring messages into Discord publication messages.
 * Consumes shared AST nodes by reference; never scans or reparses guide source.
 * Publication policy belongs here, independently of parsing and HTML rendering.
 */
export function projectDiscordMessages(document) {
  const messages = [];

  for (const source of document.messages) {
    let current;
    let lastPayload;

    function begin(options = {}) {
      current = {
        sourceMessageIndex: source.index,
        blocks: [], anchors: [], pin: null, reactions: [],
        explicitBlank: false, followsAttachment: false,
        hasTrailingBlank: false, ...options
      };
      lastPayload = null;
    }

    function finish(atExplicitBoundary = false) {
      // Metadata alone does not publish a Discord post. Blank AST blocks do:
      // the legacy preview preserves intentional blank lines around boundaries.
      if (!lastPayload) return;
      const first = current.blocks[0];
      const last = current.blocks.at(-1);
      current.range = { start: first.range.start, end: last.range.end };
      current.index = messages.length;
      current.hasTrailingBlank = atExplicitBoundary && lastPayload.type === 'blank';
      messages.push(current);
    }

    begin();
    for (const block of source.blocks) {
      if (block.type === 'command' && block.valid) {
        if (block.name === 'blank') {
          finish();
          begin({ explicitBlank: true });
        }
        current.blocks.push(block);
        if (block.name === 'tag') {
          current.anchors.push(...source.anchors.filter(anchor =>
            anchor.range.start.offset === block.range.start.offset));
        } else if (block.name === 'pin') current.pin = block.parameter;
        else if (block.name === 'react') current.reactions.push(block.parameter);
        // img/file also have an attachment node; embed has a payload node.
        // Their command nodes and other metadata never create implicit splits.
        continue;
      }

      // An embed is a payload on the current post, as in the legacy preview.
      // All ordinary content (including code, quotes and blank lines) after
      // an attachment starts the next post. Consecutive attachments stay together.
      if (lastPayload?.type === 'attachment' && !['attachment', 'embed'].includes(block.type)) {
        finish();
        begin({ followsAttachment: block.type !== 'blank', explicitBlank: block.type === 'blank' });
      }
      current.blocks.push(block);
      lastPayload = block;
    }
    finish(document.separators.some(separator => separator.start.offset === source.range.end.offset));
  }
  return messages;
}
