'use client';

import React, { useEffect, useId, useRef } from 'react';
import { Button } from './button';
import { Typography } from './typography';

export function Popover({
  visible,
  children,
  className,
}: {
  visible: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!visible) return null;
  return <div className={['finapp-popover', className].filter(Boolean).join(' ')}>{children}</div>;
}

type OverlayProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
};

export type AlertDialogProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void | Promise<void>;
  className?: string;
};

type OverlayKind = 'sheet' | 'dialog' | 'alert' | 'drawer';

function Overlay({
  visible,
  onClose,
  children,
  title = 'Actions',
  className,
  kind,
}: OverlayProps & { kind: OverlayKind }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!visible || typeof document === 'undefined') return;
    const panel = panelRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1]?.focus();
      } else if (document.activeElement === panel) {
        event.preventDefault();
        (event.shiftKey ? focusable[focusable.length - 1] : focusable[0])?.focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [visible]);

  if (!visible) return null;
  const role = kind === 'alert' ? 'alertdialog' : 'dialog';
  return (
    <div
      className={`finapp-overlay finapp-overlay--${kind}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-state="open"
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={['finapp-overlay__panel', className].filter(Boolean).join(' ')}
      >
        <div className="finapp-overlay__heading">
          {kind === 'sheet' && <span className="finapp-sheet-handle" aria-hidden="true" />}
          <Typography as="h2" variant="heading" id={titleId}>
            {title}
          </Typography>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Close"
            onPress={onClose}
            className="finapp-overlay__close"
          >
            <span aria-hidden="true">×</span>
          </Button>
        </div>
        <div className="finapp-overlay__content">{children}</div>
      </div>
    </div>
  );
}

export function Sheet(props: OverlayProps) {
  return <Overlay {...props} kind="sheet" />;
}

export function Dialog(props: OverlayProps) {
  return <Overlay {...props} kind="dialog" />;
}

export function AlertDialog({
  visible,
  onClose,
  title = 'Confirm action',
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  className,
}: AlertDialogProps) {
  const confirm = async () => {
    await onConfirm?.();
    onClose();
  };

  return (
    <Overlay visible={visible} onClose={onClose} title={title} className={className} kind="alert">
      {description ? <Typography variant="body">{description}</Typography> : null}
      {children}
      <div className="finapp-alert-dialog__actions">
        <Button variant="outline" size="sm" onPress={onClose}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'destructive' : 'primary'} size="sm" onPress={confirm}>
          {confirmLabel}
        </Button>
      </div>
    </Overlay>
  );
}

export function Drawer(props: OverlayProps) {
  return <Overlay {...props} kind="drawer" />;
}
