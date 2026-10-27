import { CanDeactivateFn } from '@angular/router';

export interface HasUnsavedChanges {
  confirmLeave(): Promise<boolean> | boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => component.confirmLeave();
