/*
 * Phone overflow check: paste this in the browser console while the app is
 * shown at phone size (for instance 375 x 812), open a window or a menu, then
 * call ``audit("name of what is open")``.
 *
 * It lists every popup, dialog, menu or bar that sticks out of the screen, and
 * tells whether the page itself scrolls sideways. ``bad: []`` means all is fine.
 *
 * Used to check each window of the app one by one (label menu, colour picker,
 * point editors, dialogs, account bubble, help bubbles...).
 */
window.audit = (label) => {
  const overlays =
    ".popover,.dialog,.menu,.flyout,.bubble,.maplibregl-popup-content,.picker,.sheet," +
    "[role=dialog],[role=alertdialog],[role=toolbar],[role=menu],[role=tooltip]";
  const bad = [];
  for (const el of document.querySelectorAll(overlays)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue; // hidden
    const outside = r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5;
    if (outside) {
      const name = `${el.tagName}.${(el.className?.toString?.() ?? "").split(" ")[0]}`;
      bad.push(`${name} [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}]`);
    }
  }
  const sideways = document.documentElement.scrollWidth > innerWidth + 1;
  return { label, viewport: [innerWidth, innerHeight], bad, page: sideways ? "PAGE scrolls sideways" : null };
};
