<!--
  Icon of a type of point of interest (spring, bivouac, shop...) or of a comment.
  The drawings are fixed strings defined in src/lib/poi.ts, never user text.
-->
<script lang="ts">
  import { pinInfo, type PinType } from "../lib/poi";

  let { type, size = 18 }: { type: PinType; size?: number } = $props();

  const info = $derived(pinInfo(type));
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {@html info.icon}
</svg>
