import { useEffect } from "react";
const cards = ".details-panel[open], .ai-options[open], .ai-source-details[open], .content-details[open], .atlas-info[open], .atlas-save[open], .paint-file-menu[open], .paint-canvas-actions[open], .weather-details[open]";
function outside(dialog: HTMLDialogElement, event: MouseEvent) {
  const box = dialog.getBoundingClientRect();
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
}
export function useCardDismissal() {
  useEffect(() => {
    let backdrop: HTMLDialogElement | null = null;
    function down(event: PointerEvent) {
      backdrop = event.target instanceof HTMLDialogElement && outside(event.target, event) ? event.target : null;
    }
    function click(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target === backdrop && backdrop?.open && outside(backdrop, event)) {
        const dialog = backdrop;
        backdrop = null;
        // Use each card's existing close handler, including React state cleanup.
        const allowed = dialog.dispatchEvent(new Event("cancel", {cancelable:true}));
        if (allowed && dialog.open) dialog.close();
        return;
      }
      backdrop = null;
      const modal = target.closest("dialog");
      document.querySelectorAll<HTMLDetailsElement>(cards).forEach(card => {
        if (modal && card.closest("dialog") !== modal) return;
        if (!card.contains(target)) card.open = false;
      });
    }
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("click", click);
    };
  }, []);
}
