import { Client, GatewayIntentBits, TextBasedChannel } from 'discord.js';
import { loadNewTokens } from './raydium';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const channelId = '1187321681405022261';

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  const channel = client.channels.cache.get(channelId) as TextBasedChannel;
  loadNewTokens(channel);
});

client.login('MTE4NzMyMjAzNTcxMDQ2NDAwMA.GiEOV9.PDsXKISSL30gF_zeVOtR1bc2Ac903GCq6FNwzs');
