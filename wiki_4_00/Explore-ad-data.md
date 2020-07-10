# Explore collected informations about ads

When you see an ad on Twitter, or when you interact with it, it is registred.

Twitter keeps up to 90 days of ad-related data linked to your account in your archive.

In `twitter-archive-reader`, ad data is stored in `archive.ads`, with `archive` an instance of `TwitterArchive`.

## Initialization
This container is initialized only if TwitterArchive's `build_ad_archive` constructor option is set to `true`.
If you haven't init this at construct time, you can still load it (if the ZIP is still loaded) with `.loadArchivePart({ current_ad_archive: true })`:

```ts
if (archive.is_zip_loaded) {
  await archive.loadArchivePart({ current_ad_archive: true });
}
```

## Available properties

- `.impressions: AdImpression[]`: Collected data about ads viewed by archive owner.

- `.engagements: AdEngagement[]`: Collected data about ads archive owner have interacted with.

- `.mobile_conversions: AdMobileConversion[]`: Mobile application events associated with archive owner account in the last 90 days which are attributable to a Promoted Tweet engagement on Twitter.
Ads which archive owner might have seen **on mobile app** and "converted" to real action:
For example: Installed an application, used an app targeted by a ad...

- `.online_conversions: AdOnlineConversion[]`: All online (website) activities associated with archive owner account in the last 90 days via advertiser website integrations which are attributable to a Promoted Tweet engagement on Twitter. Ads which archive owner might have seen **on desktop website** and "converted" to real action: For example: Clicked on the ad and see a webpage...

- `.impressions_by_location: { [location: string]: AdImpression[] }`: Impressions by display location (where archive owner seen it on Twitter environnement: Timeline, profile...)

- `.impressions_by_advertiser: { [advertiser: string]: AdImpression[] }`: Impressions by advertiser screen name (with @ in it). Real advertiser name can be obtains with `impression.advertiserInfo.advertiserName`.

- `.impressions_by_engagement_type: { [engagementType: string]: AdImpression[] }`: All impressions linked to an engagement, sorted by engagement types. A single impression can have multiple engagement types.

## Note on ad dates

At many places inside arrays and objects, you will find date-related properties.
Those props are badly formatted and can not be parsed by `Date` in all cases.

You can use static method `AdArchive.parseAdDate(date: string)` to have a correct date.
