/**
 * The collection of saved parcours and labels, as the interface shows it.
 *
 * It holds the light summaries only (enough for the side menu and the overview
 * map). A whole parcours is read from the storage when it is opened.
 */

import { PARCOURS_COLORS } from "./parcours";
import type { Label, ParcoursSummary, ParcoursType } from "./parcours";
import * as storage from "./storage";

/** Colour of the labels that are used by a parcours but missing from the list. */
const UNKNOWN_LABEL_COLOR = "#5B6660";

/**
 * What the side menu and the overview map show. An empty list or ``null``
 * means "no restriction" for that criterion.
 */
export interface Filters {
  types: ParcoursType[];
  labels: string[];
  /** Distance range in km, ``[from, to]``. */
  km: [number, number] | null;
  /** Range of the number of stages. */
  stages: [number, number] | null;
}

/** A group of the side menu: the parcours carrying one label (or none). */
export interface Group {
  key: string;
  name: string;
  color: string;
  items: ParcoursSummary[];
}

class Library {
  items = $state.raw<ParcoursSummary[]>([]);
  labels = $state.raw<Label[]>([]);
  /** Parcours selected on the overview map (highlighted in the menu). */
  selectedId = $state<string | null>(null);
  /** False if the storage cannot be reached (for instance outside ``npm run dev``). */
  available = $state(true);

  filters = $state<Filters>({ types: [], labels: [], km: null, stages: null });

  /** Longest parcours in km (rounded up): upper end of the distance slider. */
  maxKm = $derived(Math.max(1, Math.ceil(Math.max(0, ...this.items.map((i) => i.stats.distance / 1000)))));

  /** Highest number of stages: upper end of the stages slider. */
  maxStages = $derived(Math.max(1, ...this.items.map((i) => i.stages ?? 1)));

  /** The parcours that pass the filters. */
  visibleItems = $derived(this.items.filter((item) => this.matches(item)));

  /** Number of filters in use (a type, a label, the distance, the stages: each counts once). */
  activeFilterCount = $derived(
    Number(this.filters.types.length > 0) +
      Number(this.filters.labels.length > 0) +
      Number(this.filters.km !== null) +
      Number(this.filters.stages !== null),
  );

  /** Parcours grouped by label, labels in alphabetical order, unlabelled last. */
  groups = $derived.by((): Group[] => {
    const byName = (a: ParcoursSummary, b: ParcoursSummary) => a.name.localeCompare(b.name, "fr");
    const shown = this.visibleItems;
    const names = new Set([...this.labels.map((l) => l.name), ...shown.flatMap((i) => i.labels)]);
    const groups: Group[] = [...names]
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((name) => ({
        key: `label:${name}`,
        name,
        color: this.labelColor(name),
        items: shown.filter((i) => i.labels.includes(name)).sort(byName),
      }))
      .filter((group) => group.items.length > 0);
    const unlabelled = shown.filter((i) => i.labels.length === 0).sort(byName);
    if (unlabelled.length > 0) {
      groups.push({ key: "none", name: "Sans label", color: UNKNOWN_LABEL_COLOR, items: unlabelled });
    }
    return groups;
  });

  /** Tell whether a parcours passes the filters. */
  matches(item: ParcoursSummary): boolean {
    const { types, labels, km, stages } = this.filters;
    if (types.length > 0 && !types.includes(item.type)) return false;
    if (labels.length > 0 && !item.labels.some((l) => labels.includes(l))) return false;
    const distanceKm = item.stats.distance / 1000;
    if (km && (distanceKm < km[0] || distanceKm > km[1])) return false;
    const count = item.stages ?? 1;
    if (stages && (count < stages[0] || count > stages[1])) return false;
    return true;
  }

  resetFilters(): void {
    this.filters = { types: [], labels: [], km: null, stages: null };
  }

  /** Read the parcours and labels from the storage. */
  async refresh(): Promise<void> {
    try {
      const [items, labels] = await Promise.all([storage.listParcours(), storage.loadLabels()]);
      this.items = items;
      this.labels = labels;
      this.available = true;
    } catch {
      this.available = false;
    }
  }

  labelColor(name: string): string {
    return this.labels.find((l) => l.name === name)?.color ?? UNKNOWN_LABEL_COLOR;
  }

  /**
   * Create a label (or recolour it if the name already exists) and save the list.
   *
   * Returns
   * -------
   * bool
   *     False if the list could not be saved.
   */
  async addLabel(name: string, color: string): Promise<boolean> {
    this.labels = [...this.labels.filter((l) => l.name !== name), { name, color }];
    try {
      await storage.saveLabels(this.labels);
      return true;
    } catch {
      return false;
    }
  }

  /** Number of saved parcours that carry a label. */
  usageCount(name: string): number {
    return this.items.filter((i) => i.labels.includes(name)).length;
  }

  /**
   * Delete a label: remove it from the list and from every parcours that has it.
   *
   * Returns
   * -------
   * bool
   *     False if something could not be saved.
   */
  async deleteLabel(name: string): Promise<boolean> {
    try {
      for (const item of this.items.filter((i) => i.labels.includes(name))) {
        const file = await storage.loadParcours(item.id);
        file.labels = file.labels.filter((l) => l !== name);
        await storage.saveParcours(file);
      }
      this.labels = this.labels.filter((l) => l.name !== name);
      await storage.saveLabels(this.labels);
      await this.refresh();
      return true;
    } catch {
      return false;
    }
  }

  /** First colour of the palette that no saved parcours uses yet. */
  nextColor(): string {
    const used = new Set(this.items.map((i) => i.color));
    return PARCOURS_COLORS.find((c) => !used.has(c)) ?? PARCOURS_COLORS[this.items.length % PARCOURS_COLORS.length];
  }
}

/** The collection shared by all components. */
export const library = new Library();
