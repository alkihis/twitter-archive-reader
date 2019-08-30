import commander from 'commander';
import { TwitterArchive } from './Archive';
import { readFileSync, writeFileSync } from 'fs';
import { inspect } from 'util';

commander
  .option('-f, --file <zipFile>', "Archive ZIP to load")
.parse(process.argv);

const write = (name: string, data: any) => {
  writeFileSync('test_dir/'+name, typeof data === 'string' ? data : inspect(data, false, Infinity));
};

(async () => {
  const archive = new TwitterArchive(readFileSync(commander.file));

  console.log("Reading archive...");
  // You must wait for ZIP reading and archive object build
  await archive.ready();

  console.log("Archive ok");

  // List the 30 first tweets in the archive
  write('30_first', archive.all.slice(0, 5));

  // Get all the tweets sent between two dates
  write('between_tweets', archive.between(new Date("2018-01-31"), new Date("2018-02-02")).length);

  // Get all the tweets sent in one month
  write('2018_01', archive.month("1", "2018").length);

  // Get the number of tweets stored in the archive
  console.log(archive.length, "tweets in archive");

  console.log("Search test: trying to find 'hello', case insensitive");
  console.log("archive.all.filter(e => /hello/i.test(e.text))");
  const res = archive.all.filter(e => /hello/i.test(e.text));
  console.log(res.length, "results");
  write('search', res);

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
})();

