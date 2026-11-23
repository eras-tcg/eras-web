import { firstValueFrom } from 'rxjs';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { HubSlide, NewsSlide } from './hub-rules';
import { NewsDialogComponent } from './news-dialog.component';

/**
 * Where a slide of the carousel or a row of the news log leads once clicked: an edition, to its page at once; a news
 * item opens in full and leads where its button says, or nowhere when it is closed.
 */
export async function slideDestination(
  slide: HubSlide,
  modal: ModalService,
): Promise<string | undefined> {
  if (slide.kind === 'edition') return slide.link;
  return firstValueFrom(modal.open<string, NewsSlide>(NewsDialogComponent, { data: slide }).closed);
}
