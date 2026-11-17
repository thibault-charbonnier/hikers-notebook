/**
 * Svelte action: make a text area exactly as tall as its text.
 *
 * Usage: ``<textarea use:autosize={{ value: text, maxLines: 5 }}>``. The
 * height follows what is typed, and also what is put in the field by the
 * program (pass the bound value so the action hears about it) and the width
 * of the field (a narrower field wraps the text on more lines). Past
 * ``maxLines`` the field stops growing and scrolls instead.
 *
 * The text area needs an explicit ``line-height`` in its style, so the
 * number of lines can be worked out.
 */

export interface AutosizeOptions {
  /** The current text; only here so the action runs again when it changes. */
  value: string;
  /** Number of lines after which the field scrolls; no limit if absent. */
  maxLines?: number;
}

export function autosize(node: HTMLTextAreaElement, options: AutosizeOptions) {
  let maxLines = options.maxLines;

  function fit(): void {
    node.style.height = "auto"; // shrink first, so a shorter text can shrink the field
    const style = getComputedStyle(node);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);

    const wanted = node.scrollHeight + borders;
    const limit = maxLines ? maxLines * lineHeight + padding + borders : Infinity;
    node.style.height = `${Math.min(wanted, limit)}px`;
    node.style.overflowY = wanted > limit ? "auto" : "hidden";
  }

  node.addEventListener("input", fit);
  const observer = new ResizeObserver(fit);
  observer.observe(node);
  fit();

  return {
    update(next: AutosizeOptions): void {
      maxLines = next.maxLines;
      // Wait for the browser to put the new text in the field before measuring.
      queueMicrotask(fit);
    },
    destroy(): void {
      node.removeEventListener("input", fit);
      observer.disconnect();
    },
  };
}
