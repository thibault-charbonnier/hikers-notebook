/**
 * The information card shown on the overview map when a parcours is hovered
 * or selected, in a few short lines: the name (colour dot on the left, icon of
 * the type on the right); when there are several stages, a tiny bar of the stages
 * and their count; the distance (left) and the ascent (green) and descent (red),
 * glued together (right); a band with the time by car from home; and a button to
 * open it.
 *
 * It is built with DOM calls (never from user text as HTML), so names typed by
 * the user cannot inject markup. The only HTML used is fixed drawings.
 */

import { formatDuration } from "./drive";
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

/** A small car (fixed drawing). */
export const CAR_MARKUP =
  '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />';

/** A small icon from fixed drawing markup. */
function icon(markup: string, size = 14): HTMLElement {
  const node = element("span", "card-icon");
  node.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${markup}</svg>`;
  return node;
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

  // The tiny stage bar, only for several days.
  const stages = item.stages ?? 1;
  if (stages > 1) {
    const meta = element("div", "card-meta");
    const bar = element("span", "card-stagebar");
    for (let i = 0; i < stages; i++) bar.append(element("span", `piece p${i % STAGE_PATTERN_COUNT}`));
    meta.append(bar, element("b", "card-stagecount", `${stages} étapes`));
    card.append(meta);
  }

  // The distance on the left; the ascent (green) and the descent (red) glued together on the right.
  const figures = element("div", "card-figures");
  const up = element("span", "card-up", formatMeters(item.stats.ascent));
  up.prepend(icon('<path d="M12 4 22 20H2z" fill="currentColor" />', 11));
  const down = element("span", "card-down", formatMeters(item.stats.descent));
  down.prepend(icon('<path d="M12 20 2 4h20z" fill="currentColor" />', 11));
  const elevation = element("span", "card-elevation");
  elevation.append(up, down);
  figures.append(element("strong", "card-distance", formatDistance(item.stats.distance)), elevation);
  card.append(figures);

  // The time by car from home, in a clear band of its own.
  if (item.drive) {
    const band = element("div", "card-drive");
    band.title = `${item.drive.km.toLocaleString("fr-FR")} km depuis ton domicile, sans circulation`;
    band.append(icon(CAR_MARKUP, 17), element("b", "", formatDuration(item.drive.minutes)), element("span", "", "depuis chez toi"));
    card.append(band);
  }

  if (onOpen) {
    const button = element("button", "card-open", "Ouvrir") as HTMLButtonElement;
    button.type = "button";
    button.addEventListener("click", onOpen);
    card.append(button);
  }
  return card;
}
