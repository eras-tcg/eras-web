import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { Permission } from './auth.model';
import { AuthService } from './auth.service';

/**
 * Renders its content only when the current user has the permission.
 * Usage: `<button *erasCan="'manage_editions'">Editar</button>`
 */
@Directive({ selector: '[erasCan]' })
export class CanDirective {
  readonly erasCan = input.required<Permission>();

  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private rendered = false;

  constructor() {
    effect(() => {
      // reading user() makes the directive react to login and logout
      const allowed = this.auth.user() !== null && this.auth.can(this.erasCan());
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
