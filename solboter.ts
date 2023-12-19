import {
  Liquidity,
  LiquidityPoolKeys
} from "@raydium-io/raydium-sdk";

import {
  Connection
} from "@solana/web3.js";

import {
  jsonInfo2PoolKeys
} from "@raydium-io/raydium-sdk";

import {
  Token,
} from "@raydium-io/raydium-sdk";

const fs = require('fs');
const moment = require('moment-timezone');
const currentDate = moment();
const addressesToExcludeJsonPath = 'exludeAddresses.json'

let allPools: LiquidityPoolKeys[];
let allTokens : Token[];

async function sleep() {
  return new Promise(resolve => setTimeout(resolve, 350));
}

async function load_raydium_tokens(){
  const RAYDIUM_TOKEN_JSON = 'https://api.raydium.io/v2/sdk/token/raydium.mainnet.json';
  let tokensData;
  try {
    const response_tokens = await fetch(RAYDIUM_TOKEN_JSON);
    if (response_tokens.status == 200) {
      tokensData = await response_tokens.json();
    } else {
      throw('Failed to load Raydium tokens data');
    }
  } catch (error) {
    throw('Failed to load Raydium tokens data');
  }

  allTokens = (tokensData?.unOfficial.concat(tokensData?.official) || []).map((tokenObject: any) => {
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

async function load_raydium_token_pools(){
  const RAYDIUM_LIQUIDITY_JSON = 'https://api.raydium.io/v2/sdk/liquidity/mainnet.json';
  let raydiumPoolsData;
  try {
    const response = await fetch(RAYDIUM_LIQUIDITY_JSON);
    if (response.status == 200) {
      raydiumPoolsData = await response.json();
    } else {
      throw('Failed to load Raydium pools data');
    }
  } catch (error) {
    throw('Failed to load Raydium pools data');
  }

  allPools = raydiumPoolsData.official.concat(raydiumPoolsData.unOfficial).map((pool: any) => jsonInfo2PoolKeys(pool));
}

async function get_pool_info(connection: Connection, poolKeys : any) {
  try {
    await sleep();
    const poolsInfo = await Liquidity.fetchInfo({
      connection,
      poolKeys,
    });
    
    const matchingToken = await allTokens.find(token => token.mint === poolKeys.baseMint.toString());
    const dateFromTimestamp = await moment.unix(poolsInfo.startTime.toNumber());
    
    if (dateFromTimestamp.isAfter(currentDate, 'minute')) {
      const formattedDate = dateFromTimestamp.tz('Europe/Sofia').format('YYYY-MM-DD HH:mm:ss');
      console.log(`The pool of token ${matchingToken?.name} with base mint address ${poolKeys.baseMint.toString()} opens at: ${formattedDate}`);
    }

  } catch (error) {
    throw(`Error fetching liquidity pools information: ${error}`);
  }
}

async function main() {
  const connection = new Connection("https://api.mainnet-beta.solana.com");

  await load_raydium_tokens();
  await load_raydium_token_pools();

  for (const poolKeys of allPools) {
    get_pool_info(connection, poolKeys);
  };
}

// main entry 
main();
