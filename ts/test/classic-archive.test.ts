import path from 'path';
import TwitterArchive from '..';
import { MediaArchiveType } from '../MediaArchive';

// Archive load / save could take a long time
jest.setTimeout(9999999);

const UNIT_TEST_FILE = path.join(__dirname, '../../../../Programmation/Archives Twitter/CLASSIC_ALKIHIS_2018_08.zip');
const archive = new TwitterArchive(UNIT_TEST_FILE);

test('archive init', async () => {
  await archive.ready();
  expect(archive.state).toBe("ready");
});

test('archive properties', async () => {
  await archive.ready();

  expect(archive.favorites.has_extended_favorites).toBe(false);
  expect(archive.moments.length).toBe(0);
  expect(archive.user.authorized_applications.length).toBe(0);
});

test('tweets', async () => {
  await archive.ready();

  expect(archive.tweets.length).toBe(98156);
  expect(archive.tweets.find('hello', 'i').length).toBe(221);
  expect(archive.tweets.month(1, 2019).length).toBe(0);
  expect(archive.tweets.month(2, 2018).length).toBe(1433);

  // Trying to find retweets containing 'lgbt' since 2016/01/01 and until 2019/02/01, case insensitive
  expect(archive.tweets.find("since:2016 until:2019-02 lgbt", "i", ["retweets_only"]).length).toBe(7);

  // Trying to find tweets (w/out RTs) containing 'bonjour' at the beginning of the tweet, before 2018/03/25, case insensitive
  expect(archive.tweets.find("until:2018-03-25 ^bonjour", "i", ["no_retweets"]).length).toBe(103);

  expect(archive.tweets.single('181075157983559680')).toEqual({
    source: '<a href="http://twitter.com" rel="nofollow">Twitter Web Client</a>',
    entities: { user_mentions: [], media: [], hashtags: [], urls: [] },
    geo: {},
    id_str: '181075157983559680',
    text: "@loic6300 J'ai fini !",
    id: 181075157983559680,
    created_at: '2012-03-17 17:50:56 +0000',
    user: {
      name: 'Alkihis',
      screen_name: 'Alkihis',
      protected: false,
      id_str: '526738591',
      profile_image_url_https: 'https://pbs.twimg.com/profile_images/980551149668446209/aU3Lf8gt_normal.jpg',
      id: 526738591,
      verified: false
    },
    created_at_d: new Date('2012-03-17T17:50:56.000Z')
  });

  expect(archive.tweets.id_index).toHaveProperty('181075157983559680');
  expect(archive.tweets.id_index).not.toHaveProperty('20');
});

// test('archive save', async () => {
//   const as_promise = archive.ready().then(() => ArchiveSaver.create(archive));
//   const save = await ArchiveSaver.restore(as_promise);

//   expect(
//     [...archive.tweets.sortedIterator()].slice(0, 20).map(e => { delete e.created_at_d; return e })
//   ).toEqual(
//     [...save.tweets.sortedIterator()].slice(0, 20).map(e => { delete e.created_at_d; return e })
//   );
//   expect(archive.user.summary).toEqual(save.user.summary);
//   expect(archive.synthetic_info).toEqual(save.synthetic_info);
//   expect(archive.favorites.length).toBe(save.favorites.length);
//   expect(archive.user.screen_name_history.length).toBe(save.user.screen_name_history.length);
//   expect(archive.moments.length).toBe(save.moments.length);
//   expect(save.user.authorized_applications).toHaveLength(archive.user.authorized_applications.length);
//   expect(save.ads.impressions).toHaveLength(archive.ads.impressions.length);
// });

test('user data', async () => {
  await archive.ready();

  expect(archive.user.created_at).toBe('2012-03-16 19:54:13 +0000');
  expect(archive.user.id).toBe('526738591');
  expect(archive.hash).toBe('3d28bb074ca19975c80e71655358869f');
});

test('direct messages', async () => {
  await archive.ready();

  expect(archive.messages).toBe(undefined);
});

test('image dm', async () => {
  await archive.ready();

  expect(archive.medias.get(MediaArchiveType.SingleDM, "818102592802848773-BrcGVlp3.jpg")).rejects.toThrow();
});
