/**
 * The shop's odds no edition sets (DriveManager ShopOdds), each 0..1: the finish of every copy pulled or crafted, the
 * alternative art of a pulled copy (unless the art has its own) and a box's pack going up a rarity.
 */
export interface ShopOdds {
  foil: number;
  prism: number;
  alt: number;
  boxUpgrade: number;
  subEditionBoxUpgrade: number;
}
