import { PartialFavorite, GDPRFavorites } from "../types/GDPRExtended";
import Settings from "../utils/Settings";
import { dateFromFavorite, sortFavorites } from "../utils/exported_helpers";
import { TweetLikeContainer, TweetDateIndex } from "./TweetArchive";
import { TweetIndex } from "../types/Internal";
import { safePusher } from "../utils/helpers";

export class FavoriteArchive implements TweetLikeContainer<PartialFavorite> {
  protected _all: PartialFavorite[];
  protected _index: TweetIndex<PartialFavorite> = {};
  protected _date_index: TweetDateIndex<PartialFavorite>;
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
  single(tweet_id: string) {
    return this._index[tweet_id];
  }

  /**
   * @deprecated Use `.single()` instead.
   */
  get(tweet_id: string) {
    return this.single(tweet_id);
  }

  month(month: string | number, year: string | number) {
    const m = Number(month);
    const y = Number(year);
    const index = this.index;

    if (year in index) {
      if (month in index[year]) {
        return Object.values(index[year][month]);
      }
    } 
    return [];
  }

  fromThatDay(start?: Date) {
    start = start instanceof Date ? start : new Date;
    const now_m = start.getMonth();
    const now_d = start.getDate();

    const favorites: PartialFavorite[] = [];

    if (this._date_index || Settings.ENABLE_CACHE) {
      const index = this._date_index;
  
      for (const year in index) {
        for (const month in index[year]) {
          if (Number(month) === now_m + 1) {
            // Month of interest
            safePusher(
              favorites, 
              Object
                .values(index[year][month])
                .filter(t => dateFromFavorite(t).getDate() === now_d)
            );
          }
        }
      }
    }
    else {
      const now_y = start.getFullYear();

      for (const id in this._index) {
        const tweet = this._index[id];
        const date = dateFromFavorite(tweet);

        if (date.getDate() !== now_d) {
          continue;
        }
        if (date.getMonth() !== now_m) {
          continue;
        }
        if (date.getFullYear() !== now_y) {
          continue;
        }

        favorites.push(tweet);
      }
    }

    return favorites;
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
   * 
   * Favs on `2010-10` are favorites than cannot be date classed.
   */
  get index() {
    if (this._date_index)
      return this._date_index;

    const index: TweetDateIndex<PartialFavorite> = {};

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
      return 'expandedUrl' in this.all[0] || 'fullText' in this.all[0];
    }
    return false;
  }
}
