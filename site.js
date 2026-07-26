// Cancel native link dragging.
//
// Anchors are draggable by default. A few pixels of pointer drift while the
// button is down — routine on a Mac trackpad, and near-guaranteed when reaching
// for a link at the screen edge in fullscreen — passes the drag threshold. The
// browser then starts a link drag, shows its grey drag chip with the page name,
// and suppresses the click, so the navigation never happens.
//
// draggable="false" in the markup handles it portably; this catches anything
// added dynamically, and any anchor that missed the attribute.
document.addEventListener(
    "dragstart",
    (e) => {
        const t = e.target;
        if (t instanceof Element && t.closest("a[href]")) e.preventDefault();
    },
    true,
);
