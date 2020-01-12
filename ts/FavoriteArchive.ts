import { PartialFavorite, GDPRFavorites } from "./TwitterTypes";

export class FavoriteArchive {
  protected index: { [tweetId: string]: PartialFavorite } = {};
  protected fav_set: Set<string>;

  add(favs: GDPRFavorites | PartialFavorite[]) {
    for (const f of favs) {
      if ('like' in f) {
        this.index[f.like.tweetId] = f.like;
      }
      else {
        this.index[f.tweetId] = f;
      }
    }
  }

  /**
   * Check if {tweet_id} has been favorited.
   */
  has(tweet_id: string) {
    return tweet_id in this.index;
  }

  /**
   * Get favorites informations of {tweet_id}.
   * 
   * If {tweet_id} is not favorited, returns `undefined`.
   */
  get(tweet_id: string) {
    return this.index[tweet_id];
  }

  *[Symbol.iterator]() {
    yield* this.all;
  }

  /**
   * Get all the registred favorites
   */
  get all() {
    return Object.values(this.index);
  }

  /**
   * Get all favorited tweets in the archive, inside a Set for quick check (like old `archive.extended_gdpr.favorites`).
   */
  get registred() {
    if (this.fav_set) {
      return this.fav_set;
    }
    return this.fav_set = new Set(Object.keys(this.index));
  }

  /**
   * Number of favorites.
   */
  get length() {
    return this.all.length;
  }
}
