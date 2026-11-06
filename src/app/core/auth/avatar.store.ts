import { Injectable } from '@angular/core';
import { UserImageStore } from './user-image.store';

/**
 * The signed-in user's icon: an image they upload (DriveManager scales it to a square and keeps it in R2). Shown in
 * the navbar, the profile and beside their name in the simulator. Null: the initial is shown.
 */
@Injectable({ providedIn: 'root' })
export class AvatarStore extends UserImageStore {
  constructor() {
    super('/api/drive/avatars/me');
  }
}
