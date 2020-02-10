You can explore archive properties (creation date, owner...) by using the `TwitterArchive` instance.

## Properties / Accessors

- `.tweets`: Access to the `TweetArchive` instance.
- `.user`: Access to the `UserData` instance (see it in the next part)
- `.generation_date`: Archive creation date.
- `.is_gdpr`: True if archive is a GDPR archive.
- `.info`: Access to archive information. See `BasicArchiveInfo` interface.
- `.is_zip_loaded`: True if ZIP is loaded in the object.
- `.synthetic_info`: Quick info to summarize the archive.
- `.hash`: Hash for loaded archive. Used to identifiate similar archives. Based on user details, tweet count and dm count.

## GDPR archive specificities

Some properties are restricted for the GDPR archive.

- `.messages`: Access to the `DMArchive` instance. Details for this property are available in the Direct Messages section.
- `.favorites`: Access to the `FavoriteArchive` instance. Details for this property are available in the Explore Favorites.
- `.mutes`: Set of muted user IDs.
- `.blocks`: Set of blocked user IDs.
- `.followers`: Set of followers user IDs.
- `.followings`: Set of followings user IDs.
- `.moments`: Moments created by the user.
- `.lists`: Registred/Created lists of the user.

- `.ads`: Access to the `AdArchive` instance. **By default, ad data is not constructed to save time and memory. To use this container, please add `build_ad_archive: true` in constructor options, or call `.loadArchivePart({ current_ad_archive: true })`**.

- `.is_dm_images_available`: True if you have access to DM images. If this returns false, you might need to call `.loadArchivePart({ current_dm_images: true })` in order to get images to work.


Specific methods:

For details, see [Get a direct message media](./Get-a-direct-message-media.md) part.

- `.dmImage(name: string, is_group: boolean, as_array_buffer: boolean)`: Extract direct message file from its name (returns a `Promise<Blob | ArrayBuffer>`).
- `.dmImageFromUrl(url: string, is_group: boolean, as_array_buffer: boolean)`: Extract direct message file from the Twitter media URL contained in `DirectMessage` object (returns a `Promise<Blob | ArrayBuffer>`).
- `.dmImagesOf(dm: string | DirectMessage, as_array_buffer: boolean)`: Extract all medias of a DM.

Utilities:

- `.releaseZip()`: If you don't need ZIP anymore (you don't use DM images for example), you can unload it here. It will free memory.


## Continue

Next page is [User data](./User-data.md).

