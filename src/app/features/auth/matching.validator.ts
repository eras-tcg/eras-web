import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Group validator: `confirm` must equal `field`. Sets `mismatch` on the group. */
export function matching(field: string, confirm: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(field)?.value;
    const b = group.get(confirm)?.value;
    return a && b && a !== b ? { mismatch: true } : null;
  };
}
