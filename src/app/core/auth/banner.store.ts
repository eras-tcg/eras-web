import { Injectable } from '@angular/core';
import { UserImageStore } from './user-image.store';

/**
 * The signed-in user's profile banner: an image they upload (DriveManager cuts it very wide and keeps it in R2), shown
 * behind their icon and name at the top of their profile. Null: the profile's own background.
 */
@Injectable({ providedIn: 'root' })
export class BannerStore extends UserImageStore {
  constructor() {
    super('/api/drive/banners/me');
  }
}
