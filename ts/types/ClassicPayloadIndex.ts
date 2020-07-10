
export interface ClassicPayloadDetails {
  tweets: number;
  created_at: string;
  lang: string;
}

export type ClassicTweetIndex = {
  file_name: string;
  year: number;
  tweet_count: number;
  month: number;
}[];
