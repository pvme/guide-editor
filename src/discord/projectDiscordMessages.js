/**
 * Adapt parser-owned message boundaries for Discord preview and validation.
 * Consumes shared AST nodes by reference; never scans or reparses guide source.
 * Preview metadata belongs here; message splitting belongs to the parser.
 */
export function projectDiscordMessages(document) {
  const messages = [];
  let previousPayload;
  let previousTextBlock;

  for (const source of document.messages) {
    // Metadata alone has no preview. Invalid commands remain visible; blank
    // blocks preserve intentional spacing around publication boundaries.
    const payload = source.blocks.filter(block => !(block.type === 'command' && block.valid));
    if (!payload.length) continue;

    const previous = messages.at(-1);
    const explicitBoundary = previous && document.separators.some(separator =>
      separator.start.offset >= previous.range.end.offset && separator.end.offset <= source.range.start.offset);
    const afterAttachment = previousPayload?.type === 'attachment' && !explicitBoundary;
    const first = source.blocks[0], last = source.blocks.at(-1);
    const lastPayload = payload.at(-1);
    messages.push({
      index: messages.length,
      sourceMessageIndex: source.index,
      blocks: [...source.blocks], anchors: [...source.anchors],
      pin: source.pin, reactions: [...source.reactions],
      range: { start: first.range.start, end: last.range.end },
      followsAttachment: Boolean(afterAttachment && payload[0].type !== 'blank'),
      continuesList: previousTextBlock?.type === 'list' && payload[0].type === 'list',
      explicitBlank: Boolean(source.explicitBlank || (afterAttachment && payload[0].type === 'blank'))
    });
    previousPayload = lastPayload;
    previousTextBlock = payload.filter(block => block.type !== 'attachment').at(-1);
  }
  return messages;
}
