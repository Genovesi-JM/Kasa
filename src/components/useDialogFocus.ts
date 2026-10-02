import { useLayoutEffect, useRef } from "react";

interface DialogSession {
  node: HTMLElement;
  returnFocus: HTMLElement | null;
  lastFocus: HTMLElement | null;
}

const dialogs: DialogSession[] = [];
let previousBodyOverflow = "";
let scrollLocks = 0;

/** Share one scroll lock across custom and native dialogs. */
export function lockDialogScroll() {
  if (scrollLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = previousBodyOverflow;
  };
}

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "iframe",
  "summary",
  "[contenteditable='true']",
  "[tabindex]",
].join(",");

function isAvailable(element: HTMLElement) {
  return (
    element.isConnected &&
    !element.matches(":disabled") &&
    !element.closest("[hidden], [inert], [aria-hidden='true']") &&
    element.getClientRects().length > 0 &&
    window.getComputedStyle(element).visibility === "visible"
  );
}

function tabbableElements(node: HTMLElement) {
  return Array.from(node.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => element.tabIndex >= 0 && isAvailable(element))
    .sort((left, right) => {
      const leftOrder = left.tabIndex || Number.MAX_SAFE_INTEGER;
      const rightOrder = right.tabIndex || Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
}

function focusWithin(dialog: DialogSession) {
  const preferred = dialog.node.querySelector<HTMLElement>(
    "[data-dialog-initial-focus]",
  );
  const target =
    dialog.lastFocus &&
    dialog.node.contains(dialog.lastFocus) &&
    isAvailable(dialog.lastFocus)
      ? dialog.lastFocus
      : preferred && isAvailable(preferred)
        ? preferred
        : (tabbableElements(dialog.node)[0] ?? dialog.node);
  target.focus({ preventScroll: true });
}

/** Attach to a dialog root with tabIndex={-1}; omit React autoFocus. */
export function useDialogFocus<T extends HTMLElement>(
  onClose: () => void,
  {
    active = true,
    restoreFocus,
  }: { active?: boolean; restoreFocus?: () => boolean } = {},
) {
  const dialogRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  const restoreFocusRef = useRef(restoreFocus);

  useLayoutEffect(() => {
    closeRef.current = onClose;
    restoreFocusRef.current = restoreFocus;
  }, [onClose, restoreFocus]);

  useLayoutEffect(() => {
    const node = dialogRef.current;
    if (!node || !active) return;

    const session: DialogSession = {
      node,
      returnFocus:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      lastFocus: null,
    };

    const unlockScroll = lockDialogScroll();

    // Child layout effects may run first when nested dialogs mount together.
    const childIndex = dialogs.findIndex((dialog) =>
      node.contains(dialog.node),
    );
    if (childIndex >= 0) {
      session.returnFocus = dialogs[childIndex].returnFocus;
      dialogs.splice(childIndex, 0, session);
    } else {
      dialogs.push(session);
    }

    const isTopDialog = () =>
      dialogs.at(-1) === session &&
      !Array.from(
        document.querySelectorAll<HTMLDialogElement>("dialog:modal"),
      ).some((native) => !native.contains(node));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog() || event.defaultPrevented || event.isComposing) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const elements = tabbableElements(node);
      const current = document.activeElement;
      const index = elements.findIndex((element) => element === current);
      if (elements.length === 0) {
        event.preventDefault();
        node.focus({ preventScroll: true });
      } else if (event.shiftKey && index <= 0) {
        event.preventDefault();
        elements[elements.length - 1].focus();
      } else if (
        !event.shiftKey &&
        (index < 0 || index === elements.length - 1)
      ) {
        event.preventDefault();
        elements[0].focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!isTopDialog()) return;
      if (event.target instanceof HTMLElement && node.contains(event.target)) {
        session.lastFocus = event.target;
      } else {
        focusWithin(session);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    if (isTopDialog()) focusWithin(session);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      const wasTopDialog = isTopDialog();
      const index = dialogs.indexOf(session);
      if (index >= 0) dialogs.splice(index, 1);

      // Preserve a usable trigger if a parent unmounts before its child.
      for (const dialog of dialogs) {
        if (dialog.returnFocus && node.contains(dialog.returnFocus)) {
          dialog.returnFocus = session.returnFocus;
        }
      }

      unlockScroll();
      if (!wasTopDialog) return;
      if (restoreFocusRef.current && !restoreFocusRef.current()) return;

      const remaining = dialogs.at(-1);
      const trigger = session.returnFocus;
      if (
        trigger &&
        isAvailable(trigger) &&
        (!remaining || remaining.node.contains(trigger))
      ) {
        trigger.focus({ preventScroll: true });
      } else if (remaining) {
        focusWithin(remaining);
      }
    };
  }, [active]);

  return dialogRef;
}
