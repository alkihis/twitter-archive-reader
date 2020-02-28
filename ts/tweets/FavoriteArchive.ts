import { PartialFavorite, GDPRFavorites } from "../types/GDPRExtended";
import twitterSnowflakeToDate from 'twitter-snowflake-to-date';
import Settings from "../utils/Settings";
import { dateFromFavorite, sortFavorites } from "../utils/exported_helpers";

export interface FavoriteIndex { [tweetId: string]: PartialFavorite }
export interface FavoriteDateIndex { [year: string]: { [month: string]: FavoriteIndex } }

export class FavoriteArchive {
  protected _all: PartialFavorite[];
  protected _index: FavoriteIndex = {};
  protected _date_index: FavoriteDateIndex;
  protected fav_set: Set<string>;

  add(favs: GDPRFavorites | PartialFavorite[]) {
    for (const f of favs) {
      if ('like' in f) {
        this._index[f.like.tweetId] = f.like;
      }
      else {
        this._index[f.tweetId] = f;
      }
    }
    this._all = undefined;
    this._date_index = undefined;
    this.fav_set = undefined;
  }

  /**
   * Check if {tweet_id} has been favorited.
   */
  has(tweet_id: string) {
    return tweet_id in this._index;
  }

  /**
   * Get favorites informations of {tweet_id}.
   * 
   * If {tweet_id} is not favorited, returns `undefined`.
   */
  get(tweet_id: string) {
    return this._index[tweet_id];
  }

  *[Symbol.iterator]() {
    yield* this.all;
  }

  /**
   * Get all the registred favorites
   */
  get all() {
    if (this._all)
      return this._all;

    if (Settings.ENABLE_CACHE) {
      return this._all = sortFavorites(Object.values(this._index), "asc");
    }
    return sortFavorites(Object.values(this._index), "asc");
  }

  /**
   * Favorites sorted by year then months.
   */
  get index() {
    if (this._date_index)
      return this._date_index;

    const index: FavoriteDateIndex = {};

    for (const fav of this.all) {
      const d = dateFromFavorite(fav);
      const year = d.getFullYear(), month = d.getMonth() + 1;

      if (!(year in index)) {
        index[year] = {};
      }
      if (!(month in index[year])) {
        index[year][month] = {};
      }

      index[year][month][fav.tweetId] = fav;
    }

    if (Settings.ENABLE_CACHE) {
      return this._date_index = index;
    }
    return index;
  }

  /**
   * Get all favorited tweets in the archive, inside a Set for quick check (like old `archive.extended_gdpr.favorites`).
   */
  get registred() {
    if (this.fav_set) {
      return this.fav_set;
    }
    return this.fav_set = new Set(Object.keys(this._index));
  }

  /**
   * Number of favorites.
   */
  get length() {
    return this.all.length;
  }

  /** `true` if this archive's favorites supported "extended" properties: `.fullText` and `.expandedUrl`. */
  get has_extended_favorites() {
    if (this.length) {
      return 'fullText' in this.all[0];
    }
    return false;
  }
}
