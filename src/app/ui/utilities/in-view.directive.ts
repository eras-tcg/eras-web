import { Directive, ElementRef, OnDestroy, OnInit, inject, input, output } from '@angular/core';

/** Emits `inView` each time the element scrolls into view (e.g. to render the next page of a list). */
@Directive({ selector: '[erasInView]' })
export class InViewDirective implements OnInit, OnDestroy {
  /** Start loading this far before the element is actually visible. */
  readonly inViewMargin = input('600px');
  readonly inView = output<void>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const el = this.element.nativeElement;
    this.observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this.inView.emit();
        // The observer only reports changes: re-arm it so it fires again if the element is still visible after the list grew
        requestAnimationFrame(() => {
          if (!this.observer) return;
          this.observer.unobserve(el);
          this.observer.observe(el);
        });
      },
      { rootMargin: this.inViewMargin() },
    );
    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }
}
