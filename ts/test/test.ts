import commander from 'commander';
import { TwitterArchive } from '../Archive';
import { writeFileSync, fstat } from 'fs';
import { inspect } from 'util';
import TweetSearcher from '../TweetSearcher';
import Timer from 'timerize';

commander
  .option('-f, --file <zipFile>', "Archive ZIP to load")
  .option('-1, --test-one', "Test 1")
  .option('-2, --test-two', "Test 2")
  .option('-3, --test-three', "Test 3")
.parse(process.argv);

const write = (name: string, data: any) => {
  writeFileSync('test_dir/' + name, typeof data === 'string' ? data : inspect(data, false, Infinity));
};

const test_1 = async () => {
  const archive = new TwitterArchive(commander.file, true, true);

  console.log("Reading archive...");
  // You must wait for ZIP reading and archive object build
  //await archive.ready();
  console.log(await archive.ready().catch(console.error));

  await archive.loadCurrentDmImageZip();
  console.log("Archive ok");

  // Test dm
  if (archive.is_gdpr) {
    // @ts-ignore
    console.log(archive.dm_img_archive);
    try {
      const blob = await archive.dmImage("991765544733937669-512rVQq-.jpg", false, true) as ArrayBuffer;
      writeFileSync('test_dir/mon_img.jpg', Buffer.from(blob));
    } catch {}
  }

  //console.log(archive.messages.count);

  // console.log(TweetSearcher.search(archive.all, 'from:erykyu'));
  console.log(archive.all.slice(0, 5))

  // List the 30 first tweets in the archive
  write('30_first', archive.all.slice(0, 5));

  // Get all the tweets sent between two dates
  write('between_tweets', archive.between(new Date("2018-01-31"), new Date("2018-02-02")).length);

  // Get all the tweets sent in one month
  write('2018_01', archive.month("1", "2018").length);

  // Get the number of tweets stored in the archive
  console.log(archive.length, "tweets in archive");

  console.log("Search test: trying to find 'hello', case insensitive");
  const res = archive.all.filter(e => /hello/i.test(e.text));
  console.log(res.length, "results");
  write('search', res);

  // Advanced search
  console.log("Search test: trying to find retweets containing 'lgbt' since 2016/01/01 and until 2019/02/01, case insensitive");
  const res2 = TweetSearcher.search(archive.all, "since:2016-01-01 until:2019-02-01 lgbt", "i", ["retweets_only"]);
  console.log(res2.length, "results");
  write('adv_search', res2);

  console.log("Search test: trying to find tweets (only) containing 'bonjour' at the beginning of the tweet, before 2018/03/25, case insensitive");
  const res3 = TweetSearcher.search(archive.all, "until:2018-03-25 ^bonjour", "i", ["no_retweets"]);
  console.log(res3.length, "results");
  write('adv_search2', res3);

  // Tweets archive does NOT provide search functions except date helpers:
  // Because there is tons of fields in tweets and you can search in all of them.

  // DMs archive DOES provide search function and sub-objecting.
  // DMs archive is group-conversation ready.
  if (archive.is_gdpr) {
    // List the conversations available in the archive (GDPR archive)
    write('participants', 
      archive.messages.all
        .map(e => `Conversation #${e.id} between #${[...e.participants].join(', #')}`)
    );

    // List the 30 DMs of the first conversation
    write('30_first_dms', archive.messages.all[0].all.slice(0, 10));

    const conversation = archive.messages.all[0];
    
    // Search for messages around a specific DM
    // conversation.around("MESSAGE_ID", 30 /* Want 30 messages before and 30 messages after */);

    // Search for messages sent in a specific date
    write('between_conv1', conversation.between(new Date("2018-01-01"), new Date("2019-02-04")));

    // Search for messages between two specific DMs
    // conversation.between("MESSAGE_ID", "MESSAGE_2_ID");
    
    // Search for messages having specific text (use a RegExp to validate)
    write('find_dm', conversation.find(/d'intervention/i));

    // Search for messages received by a specific user
    // conversation.recipient("USER_ID");

    // Every truncature method [.find(), .between(), .month(), .sender(), .recipient()]
    // returns a sub-object (SubConversation) that have his own index and own methods.
    // This allow you to chain methods:
    /* conversation
      .find(/Hello/i)
      .between(new Date("2019-01-01"), new Date("2019-02-01"))
      .recipient(["MY_USER_1", "MY_USER_2"]); */
  }
};

const test_2 = async () => {
  const archive = new TwitterArchive(commander.file);

  console.log("Reading archive...");

  // Attendre que l'archive soit lue
  await archive.ready().catch(console.error);

  console.log("Archive ok");

  console.log(archive.length, "tweets");
  console.log(archive.messages.length, "conversations, with", archive.messages.count, "messages");
  console.log(
    archive.messages.groups.length, "group conversations with total of", 
    archive.messages.groups.reduce((acc, val) => acc + val.length, 0), "messages"
  );
  console.log(
    archive.messages.directs.length, "direct conversations with total of", 
    archive.messages.directs.reduce((acc, val) => acc + val.length, 0), "messages"
  );
};

const test_3 = async () => {
  // Test archive import/export
  const test_archive = new TwitterArchive(commander.file);

  // Attendre que l'archive soit lue
  await test_archive.ready().catch(console.error);

  console.log("Archive ok");

  Timer.default_format = "s";
  const timer = new Timer;
  const exported = await test_archive.exportSave();

  console.log("Archive exported in", timer.elapsed, "seconds");

  timer.reset();

  console.log("Creation archive from export");

  const archive = await TwitterArchive.importSave(exported);

  console.log("Archive imported in", timer.elapsed, "seconds");

  console.log(archive.length, "tweets");
  console.log(archive.messages.length, "conversations, with", archive.messages.count, "messages");
  console.log(
    archive.messages.groups.length, "group conversations with total of", 
    archive.messages.groups.reduce((acc, val) => acc + val.length, 0), "messages"
  );
  console.log(
    archive.messages.directs.length, "direct conversations with total of", 
    archive.messages.directs.reduce((acc, val) => acc + val.length, 0), "messages"
  );
};

if (commander.testOne) {
  test_1();
}
if (commander.testTwo) {
  test_2();
}
if (commander.testThree) {
  test_3();
}