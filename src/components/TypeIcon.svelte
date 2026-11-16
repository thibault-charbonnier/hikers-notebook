<!--
  Small icon for a type of parcours: footprints (marche), mountain
  (randonnée), dome tent (trek).
-->
<script lang="ts">
  import type { ParcoursType } from "../lib/parcours";
  import { TYPE_ICON_MARKUP } from "../lib/typeIcons";

  let { type, size = 18 }: { type: ParcoursType; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {@html TYPE_ICON_MARKUP[type]}
</svg>
