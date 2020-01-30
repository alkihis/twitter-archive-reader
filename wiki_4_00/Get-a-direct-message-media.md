GDPR archives also contain all medias uploaded to Twitter, linked to tweets and DMs. 
While medias linked to tweets can be obtained through their URL (always public, even if the account is protected), direct message medias are protected with OAuth. 

To facilitate the media obtention, `twitter-archive-reader` can find for you the right file linked to a direct message with methods available on the `TwitterArchive` instance.

You can load with the image name (`'xi9309239xx-91.jpg'` for example), or directly from a URL (present in the `mediaUrls` property of a DM).

The two methods take the name or URL in first argument, 
a boolean indicating if the image should be found in the group DM archive or not, 
and a final argument (boolean) if the function should return an `ArrayBuffer` instead of a `Blob`.

**Please note that, in Node.js, the third argument should be always set to `true`, due to the unavailability of the `Blob` in this platform**.

- `.dmImage`: Get an image from an image name. 
- `.dmImageFromUrl`: Get an image from a media URL.

A third method on `TwitterArchive` is available.
- `.dmImagesOf`: Get all the medias affiliated to a Direct Message (currenly, only one is possible, but it's future proof). This method does not require to indicate if the DM is in a group conversation or not. 

We assume that we have a DM in variable `message`, with `message.mediaUrls.length > 0`.
The message does **not** come from a group conversation (`conversation.is_group_conversation === false`).

If the media is not found **(that can happen !)**, returned `Promise` is *rejected*.

```ts
/* Browser */
// Get the image
const blob = await archive.dmImageFromUrl(message.mediaUrls[0]) as Blob;

// Create a URL and set it as img
const url = URL.createObjectURL(blob);
document.querySelector('img').src = url;

/* Node.js */
// Get the image
const array_buffer = await archive.dmImageFromUrl(message.mediaUrls[0], false, true) as ArrayBuffer;
// Write the file to disk
fs.writeFileSync('test_dir/my_img.jpg', Buffer.from(array_buffer));

// Get all the images
// Second parameter indicate if medias should be returned as ArrayBuffer
const all_images = await archive.dmImagesOf(message, true);
```

## Continue

Next part is [Explore favorites](./Explore-favorites).

