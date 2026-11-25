<!--
  An address box with suggestions: the person types, a list of real addresses
  drops down (see geocode.ts), and an address only counts once it has been
  picked from the list, so it is always valid and has a position.

  ``onpick`` is called with the chosen address, or with ``null`` as soon as the
  text is changed again (the old choice no longer matches what is typed).
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type { HomeAddress } from "../lib/drive";
  import { suggestAddresses } from "../lib/geocode";

  let { initial = null, onpick }: { initial?: HomeAddress | null; onpick: (address: HomeAddress | null) => void } = $props();

  // Only the first value matters: afterwards the field is the one that changes.
  let text = $state(untrack(() => initial?.label ?? ""));
  let picked = $state<HomeAddress | null>(untrack(() => initial));
  let suggestions = $state<HomeAddress[]>([]);
  let open = $state(false);
  let active = $state(0);
  let searched = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  function onInput(): void {
    if (picked) {
      picked = null;
      onpick(null);
    }
    clearTimeout(timer);
    controller?.abort();
    searched = false;
    if (text.trim().length < 3) {
      suggestions = [];
      open = false;
      return;
    }
    timer = setTimeout(async () => {
      controller = new AbortController();
      const found = await suggestAddresses(text, controller.signal);
      if (controller.signal.aborted) return;
      suggestions = found;
      active = 0;
      searched = true;
      open = true;
    }, 250);
  }

  function pick(address: HomeAddress): void {
    picked = address;
    text = address.label;
    open = false;
    onpick(address);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      active = (active + 1) % suggestions.length;
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      active = (active - 1 + suggestions.length) % suggestions.length;
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(suggestions[active]);
    } else if (event.key === "Escape") {
      event.stopPropagation();
      open = false;
    }
  }
</script>

<div class="field">
  <input
    type="text"
    bind:value={text}
    placeholder="Commence à taper ton adresse…"
    autocomplete="off"
    spellcheck="false"
    aria-label="Adresse du domicile"
    oninput={onInput}
    onkeydown={onKeydown}
    onfocus={() => (open = suggestions.length > 0 && !picked)}
    onblur={() => setTimeout(() => (open = false), 150)}
  />
  {#if picked}<span class="ok" title="Adresse reconnue" aria-label="Adresse reconnue">✓</span>{/if}

  {#if open}
    <ul role="listbox">
      {#each suggestions as address, i (address.label + i)}
        <li role="option" aria-selected={i === active}>
          <button type="button" class:active={i === active} onmousedown={(event) => event.preventDefault()} onclick={() => pick(address)}>
            {address.label}
          </button>
        </li>
      {:else}
        {#if searched}<li class="none">Aucune adresse trouvée.</li>{/if}
      {/each}
    </ul>
  {/if}
</div>

<style>
  .field {
    position: relative;
  }

  input {
    width: 100%;
    min-height: 40px;
    padding: 0 34px 0 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #fff;
    color: var(--text);
    font: inherit;
    font-size: 16px;
    font-weight: 400;
  }

  input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }

  .ok {
    position: absolute;
    right: 12px;
    top: 10px;
    color: var(--accent);
    font-weight: 700;
  }

  ul {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 4px);
    z-index: 5;
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(31, 42, 36, 0.25);
  }

  li button {
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 14px;
    font-weight: 400;
    text-align: left;
    cursor: pointer;
  }

  li button.active {
    background: var(--accent-soft);
  }

  .none {
    padding: 8px 10px;
    font-size: 13px;
    color: var(--muted);
  }
</style>
