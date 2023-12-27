import {
  Liquidity,
  LiquidityPoolKeys,
  SPL_MINT_LAYOUT,
  jsonInfo2PoolKeys
} from "@raydium-io/raydium-sdk";

import {
  Connection,
  PublicKey,
} from "@solana/web3.js";

import { 
  TextBasedChannel 
} from 'discord.js';

import { 
  Metaplex 
} from "@metaplex-foundation/js";

import {
   ENV,
   TokenListProvider
} from "@solana/spl-token-registry";

import {
  ExtendedToken, 
  TokenMetadata
} from './types';

import {
  defines, 
  fs, 
  moment,
  sleep
} from './constants'

import { 
  readFileSync,
} from 'fs';

let allPools: LiquidityPoolKeys[];
let allTokens : ExtendedToken[];

async function getTokenMedatadaFromMetaplex(key : string) {
  console.log(`Starting to fetch token metadata from metaplex from mint key: ${key}.`);

  const connection = new Connection(defines.solana_endpoint);
  const metaplex = Metaplex.make(connection);
  const mintAddress = new PublicKey(key);

  const metadataAccount = metaplex
      .nfts()
      .pdas()
      .metadata({ mint: mintAddress });

  if (await connection.getAccountInfo(metadataAccount)) {
        const token = await metaplex.nfts().findByMint({ mintAddress: mintAddress });
        console.log('Fetched token metadata from metaplex successfully.');
        return new TokenMetadata(token.name , token.symbol, token.json?.image || '');
    }

    console.log('Getting token metadata from metaplex failed. Returning undefined object.');
    return undefined;
}

async function getTokenMetadatafromTokenListProvider(key : string) {
  console.log(`Starting to fetch token metadata from token list provider from mint key: ${key}.`);
  const mintAddress = new PublicKey(key);
  const provider = await new TokenListProvider().resolve();
  const tokenList = provider.filterByChainId(ENV.MainnetBeta).getList();
  
  const tokenMap = tokenList.reduce((map, item) => {
      map.set(item.address, item);
          return map;
      }, new Map());

  const token = tokenMap.get(mintAddress.toBase58());
  console.log('Fetched token metadata from list provider successfully.');
  return new TokenMetadata(token.name , token.symbol, token.logoURI);

}

async function filterNotOpenedPools(){
  console.log('Start filtering not opened pools');
  const openedPoolsContent = readFileSync(defines.opened_pools, 'utf8');
  const openedPoolsMintAddresses = JSON.parse(openedPoolsContent);

  console.log('Opened pools mint addresses count: ', openedPoolsMintAddresses.length);
  console.log('Pools count before filtering: ', allPools.length);

  if (Array.isArray(openedPoolsMintAddresses)) {
    allPools = allPools.filter((pool) => {
      const baseMint = pool.baseMint.toString();
      return !openedPoolsMintAddresses.some((address: any) => address.mintAddress === baseMint);
    });
    
  console.log('Pools count after filtering:', allPools.length);
  console.log('End filtering not opened pools');
  }
}

async function loadRaydiumTokens(){
  console.log('Start loading raydium token list');
  let tokensData;
  try {
    const response_tokens = await fetch(defines.raydium_tokens_endpoint);
    if (response_tokens.status == 200) {
      tokensData = await response_tokens.json();
      console.log('Successfully fetched raydium tokens list');
    } else {
      console.log('Failed to load Raydium tokens data');
      throw('Failed to load Raydium tokens data');
    }
  } catch (error) {
    console.log('Failed to load Raydium tokens data');
    throw('Failed to load Raydium tokens data');
  }

  allTokens = (tokensData?.unOfficial.concat(tokensData?.official.concat(tokensData?.unNamed)) || []).map((tokenObject: any) => {
    return {
      symbol: tokenObject.symbol,
      name: tokenObject.name,
      mint: tokenObject.mint,
      decimals: tokenObject.decimals,
      extensions: tokenObject.extensions,
      icon: tokenObject.icon,
      hasFreeze: tokenObject.hasFreeze,
    };
  }); 
}

async function loadRaydiumTokenPools(){
  console.log('Start loading raydium token pools');
  let raydiumPoolsData;
  try {
    const response = await fetch(defines.raydium_liquidity_endpoint);
    if (response.status == 200) {
      raydiumPoolsData = await response.json();
      console.log('Raydium token pools succesfully loaded');
    } else {
      console.log('Failed to load Raydium pools data');
      throw('Failed to load Raydium pools data');
    }
  } catch (error) {
    console.log('Failed to load Raydium pools data');
    throw('Failed to load Raydium pools data');
  }

  allPools = raydiumPoolsData.official.concat(raydiumPoolsData.unOfficial).map((pool: any) => jsonInfo2PoolKeys(pool));
}

async function isAlreadySentToDiscord(mintAddr : string) {
  let sentTokens: any[] = [];

  try {
    const jsonContent = fs.readFileSync(defines.sent_pools, 'utf8');
    sentTokens = JSON.parse(jsonContent);
    if (!Array.isArray(sentTokens)) {
      sentTokens = [];
    }
  } catch (readError) {
    return false;
  }

  let foundToken;
  if(sentTokens.length != 0 && sentTokens.length != undefined)
    foundToken = sentTokens.find((token : any) => token.mintAddress === mintAddr);

  if(foundToken === undefined){
    const tokenMintAddress = {
      mintAddress: mintAddr
    };

    sentTokens.push(tokenMintAddress);
    const newJsonData = JSON.stringify(sentTokens, null, 2);
    fs.writeFile(defines.sent_pools, newJsonData, 'utf8', (err : NodeJS.ErrnoException) => {
      if (err) {
        console.error('Error writing to file:', err);
      } 
    });
    return false;
  }

  return true;
}

async function getRaydiumPoolInfo(connection: Connection, poolKeys : any, channel : TextBasedChannel) {
  console.log('Start fetching raydium pool information ...');
  
  try {
    sleep();
    const currentDate = moment();
    const poolsInfo = await Liquidity.fetchInfo({
      connection,
      poolKeys,
    });
    
    const matchingToken = allTokens.find(token => token.mint === poolKeys.baseMint.toString());
    if(matchingToken === undefined)
      return;

    const dateFromTimestamp = moment.unix(poolsInfo.startTime.toNumber());
    
    if(dateFromTimestamp.isBefore(currentDate, 'mintue')){
      const passedToken = {
        mintAddress:  matchingToken?.mint.toString()
      };

      let existingData = [];
      try {
        const existingContent = fs.readFileSync(defines.opened_pools, 'utf8');
        existingData = JSON.parse(existingContent);
      } catch (readError) {
      }
      
      existingData.push(passedToken);

      const jsonData = JSON.stringify(existingData, null, 2);

      fs.writeFile(defines.opened_pools, jsonData, 'utf8', (err : NodeJS.ErrnoException) => {
        if (err) {
          console.error('Error writing to file:', err);
        } 
      });
    }
    else{
      const differenceInMinutes = dateFromTimestamp.diff(currentDate, 'minutes');
      if(differenceInMinutes > 30){
        return;
      }

      if(await isAlreadySentToDiscord(matchingToken.mint.toString())){
        return;
      }
      const formattedDate = dateFromTimestamp.tz('Europe/Sofia').format('YYYY-MM-DD HH:mm:ss');

      let key = new PublicKey(matchingToken.mint.toString());

      let data;
      try {
        const tokenAccountInfo = await connection.getAccountInfo(key);
        if (!tokenAccountInfo) {
          console.error('Token account not found');
          return;
        }
        data = SPL_MINT_LAYOUT.decode(tokenAccountInfo.data);
        console.log(data);
      }
      catch(err){
      }

      let tokenName,
        tokenSymbol,
        tokenLogo;

        let res;
        try{
          res = await getTokenMedatadaFromMetaplex(matchingToken.mint.toString());
      }
      catch (error){
        try{
          res = await getTokenMetadatafromTokenListProvider(matchingToken.mint.toString());
        }
        catch(error){
        }
      }

      if(res != undefined){
          tokenName = res.tokenName;
          tokenSymbol = res.tokenSymbol;
          tokenLogo = res.tokenLogo;
      }
      else{
          tokenLogo = matchingToken.icon?.toString() || '';
          tokenName = matchingToken.name;
          tokenSymbol = matchingToken.symbol;
      }

      const messageOptions = {
        embeds: [
          {
            title: `${tokenSymbol?.toString() || ''} / ${tokenName?.toString() || ''}`,
            description: `**Mint address**: ${matchingToken.mint} \n
            **Decimals**: ${data?.decimals.toString() || ''} \n
            **Supply**: ${data?.supply.toString() || ''} \n
            **Pool open at timestamp(Europe/Sofia)**: ${formattedDate} \n
            **Birdeye token**: https://birdeye.so/token/${matchingToken.mint}?chain=solana \n
            **RugCheck**: https://rugcheck.xyz/tokens/${matchingToken.mint}`,
            image: {url: tokenLogo},
          },
        ],
      };

      console.log('Fetching raydium pool information successfully. Message is attempting to be sent in discord');

      channel.send(messageOptions);
    }
  } catch (error) {
    console.error("Error fetching liquidity pools information:", error);
  }
}

export async function loadNewTokens(channel : TextBasedChannel) {
  const connection = new Connection("https://api.mainnet-beta.solana.com", 'confirmed');

  try {
    await loadRaydiumTokens();
    await loadRaydiumTokenPools();
    await filterNotOpenedPools();

    for (const poolKeys of allPools) {        
      await getRaydiumPoolInfo(connection, poolKeys, channel);
    };
  }
  catch{    
  }

  loadNewTokens(channel);
}
