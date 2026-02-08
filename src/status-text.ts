/**
 * Build status bar text for the orchestrator extension.
 * Pure function — easy to test, called from the extension with live pool/store data.
 */
export function getAgentStatusText(
  running: number,
  queued: number,
  reviewCount: number,
): string | undefined {
  const parts: string[] = [];

  if (running > 0 || queued > 0) {
    parts.push(`${running} running`);
    if (queued > 0) parts.push(`${queued} queued`);
  }

  if (reviewCount > 0) {
    parts.push(`${reviewCount} to review`);
  }

  if (parts.length === 0) return undefined;

  let text = `🤖 ${parts.join(", ")}`;

  // Add shortcut hint when review is the only thing showing
  if (running === 0 && queued === 0 && reviewCount > 0) {
    text += " (Ctrl+Shift+A)";
  }

  return text;
}
