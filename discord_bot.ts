import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  const channelId = 'YOUR_CHANNEL_ID';

   client.once('ready', async () =>  {
    console.log(`Logged in as ${client.user?.tag}!`);
    await sendMessageInterval();
  });

  client.login('YOUR_BOT_TOKEN'); // Replace with your bot token

  async function sendMessageInterval() {
    setInterval(() => {
      const channel = client.channels.cache.get(channelId);
  
      if (channel?.isText()) {
        channel.send('Hello, this is your scheduled message!');
      }
    }, 60000); // Replace with your desired interval in milliseconds (e.g., 60000 for every minute)
  }
  