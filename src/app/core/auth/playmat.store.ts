import { Injectable } from '@angular/core';
import { UserImageStore } from './user-image.store';

/**
 * The signed-in user's playmat: an image they upload (DriveManager cuts it wide and keeps it in R2), shown under their
 * half of the simulator's table, to them and to their rival. Null: the table's own texture.
 */
@Injectable({ providedIn: 'root' })
export class PlaymatStore extends UserImageStore {
  constructor() {
    super('/api/drive/playmats/me');
  }
}
