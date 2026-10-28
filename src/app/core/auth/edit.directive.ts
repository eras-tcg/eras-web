import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { Permission } from './auth.model';
import { EditModeService } from './edit-mode.service';

/**
 * Renders its content only while edit mode is on and the user has the permission.
 * Usage: `<button *erasEdit="'manage_editions'">Editar</button>`
 */
@Directive({ selector: '[erasEdit]' })
export class EditDirective {
  readonly erasEdit = input.required<Permission>();

  private readonly editMode = inject(EditModeService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private rendered = false;

  constructor() {
    effect(() => {
      const allowed = this.editMode.allows(this.erasEdit());
      if (allowed && !this.rendered) {
        this.container.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.container.clear();
        this.rendered = false;
      }
    });
  }
}
