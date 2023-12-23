import { Client, GatewayIntentBits, TextBasedChannel } from 'discord.js';
import { get_new_tokens } from './solboter';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const channelId = '1187321681405022261';

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  await sendMessageInterval();
});

client.login('MTE4NzMyMjAzNTcxMDQ2NDAwMA.GiEOV9.PDsXKISSL30gF_zeVOtR1bc2Ac903GCq6FNwzs');

async function sendMessageInterval() {
    const channel = client.channels.cache.get(channelId) as TextBasedChannel;
    get_new_tokens(channel);
}
