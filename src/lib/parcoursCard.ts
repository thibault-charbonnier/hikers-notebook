/**
 * The information card shown on the overview map when a parcours is hovered
 * or selected, in at most four lines: the name (colour dot on the left, icon of
 * the type on the right); the stages (a tiny bar and their count), only when
 * there are several; three figures (distance, ascent, descent); and a button
 * to open it.
 *
 * It is built with DOM calls (never from user text as HTML), so names typed by
 * the user cannot inject markup. The only HTML used is fixed drawings.
 */

import { formatDistance, formatMeters } from "./format";
import { PARCOURS_TYPES, STAGE_PATTERN_COUNT } from "./parcours";
import type { ParcoursSummary } from "./parcours";
import { TYPE_ICON_MARKUP } from "./typeIcons";

/** Create an element with a class and some text. */
function element(tag: string, className: string, text = ""): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** A small icon from fixed drawing markup. */
function icon(markup: string, size = 14): HTMLElement {
  const node = element("span", "card-icon");
  node.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${markup}</svg>`;
  return node;
}

/** One of the three figures: an optional icon, the value, and what it is. */
function figure(kind: string, value: string, label: string, markup?: string): HTMLElement {
  const tile = element("div", `card-figure ${kind}`);
  const top = element("div", "card-figure-value");
  if (markup) top.append(icon(markup, 11));
  top.append(element("span", "", value));
  tile.append(top, element("div", "card-figure-label", label));
  return tile;
}

/**
 * Build the card of a parcours.
 *
 * Parameters
 * ----------
 * item : ParcoursSummary
 *     The parcours to describe.
 * onOpen : function, optional
 *     If given, the card gets an "Ouvrir" button (centred, full width) that
 *     calls it.
 *
 * Returns
 * -------
 * HTMLElement
 *     The card, ready to be put in a popup.
 */
export function buildParcoursCard(item: ParcoursSummary, onOpen?: () => void): HTMLElement {
  const card = element("div", "card");
  card.style.setProperty("--stage-color", item.color);

  // Line 1: colour dot, name, and (far right) the icon of the type, with no text.
  const typeLabel = PARCOURS_TYPES.find((t) => t.id === item.type)?.label ?? "";
  const title = element("div", "card-title");
  const swatch = element("span", "card-swatch");
  swatch.style.background = item.color;
  const type = icon(TYPE_ICON_MARKUP[item.type], 18);
  type.classList.add("card-type");
  type.title = typeLabel;
  title.append(swatch, element("strong", "", item.name), type);
  card.append(title);

  // Line 2, only for several days: the tiny stage bar and the count.
  const stages = item.stages ?? 1;
  if (stages > 1) {
    const meta = element("div", "card-meta");
    const bar = element("span", "card-stagebar");
    for (let i = 0; i < stages; i++) bar.append(element("span", `piece p${i % STAGE_PATTERN_COUNT}`));
    meta.append(bar, element("b", "card-stagecount", `${stages} étapes`));
    card.append(meta);
  }

  // Line 3: distance, ascent and descent.
  const figures = element("div", "card-figures");
  figures.append(
    figure("distance", formatDistance(item.stats.distance), "Distance"),
    figure("up", formatMeters(item.stats.ascent), "Dénivelé +", '<path d="M12 4 22 20H2z" fill="currentColor" />'),
    figure("down", formatMeters(item.stats.descent), "Dénivelé −", '<path d="M12 20 2 4h20z" fill="currentColor" />'),
  );
  card.append(figures);

  if (onOpen) {
    const button = element("button", "card-open", "Ouvrir") as HTMLButtonElement;
    button.type = "button";
    button.addEventListener("click", onOpen);
    card.append(button);
  }
  return card;
}
