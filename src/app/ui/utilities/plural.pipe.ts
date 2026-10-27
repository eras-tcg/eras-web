import { Pipe, PipeTransform } from '@angular/core';

/** `{{ n | plural: 'nota' }}` -> "1 nota" / "3 notas"; pass the plural form for irregular words. */
@Pipe({ name: 'plural' })
export class PluralPipe implements PipeTransform {
  transform(count: number, singular: string, plural = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : plural}`;
  }
}
