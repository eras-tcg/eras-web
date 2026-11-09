import { firstValueFrom } from 'rxjs';
import { ModalService } from '../../surfaces/modal/modal.service';
import { ImageFramerData, ImageFramerDialogComponent } from './image-framer-dialog.component';

/** Lets the player frame `data.file`; resolves the framed image, or undefined when cancelled. */
export function frameImage(modal: ModalService, data: ImageFramerData): Promise<File | undefined> {
  return firstValueFrom(modal.open<File, ImageFramerData>(ImageFramerDialogComponent, { data, maxWidth: '95vw' }).closed);
}
