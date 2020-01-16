import path from 'path';
import TwitterArchive from '..';
import ArchiveSaver from '../ArchiveSaver';

// Archive load / save could take a long time
jest.setTimeout(9999999);

const UNIT_TEST_FILE = path.join(__dirname, '../../../Documents/Archives Twitter/GDPR-2019-09-16-ALKIHIS.zip');
const archive = new TwitterArchive(UNIT_TEST_FILE, { build_ad_archive: true, load_images_in_zip: true });

test('archive init', async () => {
  await archive.ready();
  expect(archive.state).toBe("ready");
});

test('archive properties', async () => {
  await archive.ready();

  expect(archive.favorites.has_extended_favorites).toBe(true);
  expect(archive.moments.length).toBe(1);
  expect(archive.user.authorized_applications.length).toBe(2);
});

test('tweets', async () => {
  await archive.ready();

  expect(archive.tweets.length).toBe(102836);
  expect(archive.tweets.find('hello', 'i').length).toBe(223);
  expect(archive.tweets.month(1, 2019).length).toBe(702);

  // Trying to find retweets containing 'lgbt' since 2016/01/01 and until 2019/02/01, case insensitive
  expect(archive.tweets.find("since:2016 until:2019-02 lgbt", "i", ["retweets_only"]).length).toBe(11);
  
  // Trying to find tweets (w/out RTs) containing 'bonjour' at the beginning of the tweet, before 2018/03/25, case insensitive
  expect(archive.tweets.find("until:2018-03-25 ^bonjour", "i", ["no_retweets"]).length).toBe(102);

  expect(archive.tweets.single('1173645946045026306')).toEqual({
    retweeted: false,
    source: '<a href="https://about.twitter.com/products/tweetdeck" rel="nofollow">TweetDeck</a>',
    entities: { hashtags: [], symbols: [], user_mentions: [ {
      name: 'Who are you again ?',
      screen_name: 'Urylas',
      indices: [ '0', '7' ],
      id_str: '3034082091',
      id: '3034082091'
    } ], urls: [] },
    display_text_range: [ '0', '272' ],
    favorite_count: 0,
    in_reply_to_status_id_str: '1173643816399777792',
    id_str: '1173645946045026306',
    in_reply_to_user_id: '3034082091',
    truncated: false,
    retweet_count: 0,
    id: '1173645946045026306',
    in_reply_to_status_id: '1173643816399777792',
    created_at: 'Mon Sep 16 17:12:53 +0000 2019',
    favorited: false,
    full_text: "@Urylas C'est pas encore 100% compatible mobile après ;;\n" +
      '\n' +
      "C'est un truc qu'on demande pour voir ses données twitter\n" +
      '\n' +
      "Sur l'app, tu peux sur paramètres &gt; compte &gt; vos données twitter\n" +
      'Tu rentres ton mdp et tu pourras demander un lien de ton archive, envoyé par email !',
    lang: 'fr',
    contributors: [ '232559929' ],
    in_reply_to_screen_name: 'Urylas',
    in_reply_to_user_id_str: '3034082091',
    user: {
      protected: false,
      id_str: '526738591',
      name: 'Alkihis',
      screen_name: 'Alkihis',
      profile_image_url_https: 'https://pbs.twimg.com/profile_images/1153304803583414273/5TuBisCG.png'
    },
    text: "@Urylas C'est pas encore 100% compatible mobile après ;;\n" +
      '\n' +
      "C'est un truc qu'on demande pour voir ses données twitter\n" +
      '\n' +
      "Sur l'app, tu peux sur paramètres &gt; compte &gt; vos données twitter\n" +
      'Tu rentres ton mdp et tu pourras demander un lien de ton archive, envoyé par email !',
    created_at_d: new Date('2019-09-16T17:12:53.000Z')
  });

  expect(archive.tweets.id_index).toHaveProperty('1173645946045026306');
  expect(archive.tweets.id_index).not.toHaveProperty('20');
});

test('archive save', async () => {
  const as_promise = archive.ready().then(() => ArchiveSaver.create(archive, {
    tweets: true,
    dms: true,
    mutes: true,
    blocks: true,
    favorites: true,
    moments: true,
    user: {
      applications: true
    },
    ad_archive: true
  }));
  const save = await ArchiveSaver.restore(as_promise);

  expect(
    [...archive.tweets.sortedIterator()].slice(0, 20).map(e => { delete e.created_at_d; return e })
  ).toEqual(
    [...save.tweets.sortedIterator()].slice(0, 20).map(e => { delete e.created_at_d; return e })
  );
  expect(archive.user.summary).toEqual(save.user.summary);
  expect([...archive.blocks]).toEqual([...save.blocks]);
  expect(archive.favorites.all.slice(0, 30)).toEqual(save.favorites.all.slice(0, 30));
  expect(archive.synthetic_info).toEqual(save.synthetic_info);
  expect(archive.favorites.length).toBe(save.favorites.length);
  expect(archive.user.screen_name_history.length).toBe(save.user.screen_name_history.length);
  expect(archive.moments.length).toBe(save.moments.length);
  expect(save.user.authorized_applications).toHaveLength(archive.user.authorized_applications.length);
  expect(save.ads.impressions).toHaveLength(archive.ads.impressions.length);
});

test('user data', async () => {
  await archive.ready();

  expect(archive.user.account_creation_ip).toBe('89.83.162.242');
  expect(archive.user.created_at).toBe('2012-03-16T19:54:13.000Z');
  expect(archive.user.id).toBe('526738591');
  expect(archive.hash).toBe('3001500eb6f7eae546976b93d7d5b5f7');
  expect(archive.user.profile_img_url).toBe('https://pbs.twimg.com/profile_images/1153304803583414273/5TuBisCG.png');
  expect(archive.user.timezone).toBe('Paris');
  expect(archive.user.last_logins.length).toBe(294);
  expect(archive.user.verified).not.toBe(true);
  expect(archive.user.personalization.demographics.gender).toBe('male');
  expect(archive.user.personalization.demographics.languages[0]).toBe('French');
});

test('direct messages', async () => {
  await archive.ready();

  expect(archive.messages).not.toBe(undefined);
  expect(archive.messages.length).toBe(108);
  expect(archive.messages.count).toBe(145436);
  expect(archive.messages.sorted_by_date[0].all[0]).toHaveProperty('id', '739055630191841283');
  expect(archive.messages.sorted_by_date[0].all[0]).toHaveProperty('previous', null);
  expect(archive.messages.sorted_by_date[0].id);
});

test('image dm', async () => {
  await archive.ready();

  if (!archive.is_dm_images_available) {
    // this is never true
    await archive.loadArchivePart({ current_dm_images: true });
  }
  archive.releaseZip();

  const image = await archive.dmImage("818102592802848773-BrcGVlp3.jpg", false, true) as ArrayBuffer;
  expect(image.byteLength).toBe(47371);

  const group_img = await archive.dmImage("890153850757427204-zZjQV7v4.jpg", true, true) as ArrayBuffer;
  expect(group_img.byteLength).toBe(38360);

  const images_of = await archive.dmImagesOf("1137291040317218820", true) as ArrayBuffer[];
  expect(images_of.length).toBe(1);
  expect(images_of[0].byteLength).toBe(105634);
});
