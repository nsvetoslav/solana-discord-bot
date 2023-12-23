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

import { readFileSync, writeFile } from 'fs';

let allPools: LiquidityPoolKeys[];
let allTokens : Token[];

async function sleep() {
  return new Promise(resolve => setTimeout(resolve, 350));
}

async function remove_old_tokens(){
  const excludedAddressesContent = readFileSync(addressesToExcludeJsonPath, 'utf8');
  const excludedAddresses = JSON.parse(excludedAddressesContent);

  console.log('excluded mint addresses count: ', excludedAddresses.length);
  console.log('all pools count before filtering: ', allPools.length);

  if (Array.isArray(excludedAddresses)) {
    allPools = allPools.filter((pool) => {
      const poolMint = pool.baseMint.toString();
      return !excludedAddresses.some((address: any) => address.mintAddress === poolMint);
    });
    
  console.log('all pools count after filtering:', allPools.length);
}
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
    sleep();
    const poolsInfo = await Liquidity.fetchInfo({
      connection,
      poolKeys,
    });
    
    const matchingToken = allTokens.find(token => token.mint === poolKeys.baseMint.toString());
    const dateFromTimestamp = moment.unix(poolsInfo.startTime.toNumber());
    
    if(dateFromTimestamp.isBefore(currentDate, 'mintue')){
      const passedToken = {
        mintAddress: matchingToken?.mint.toString()
      };

      if(matchingToken?.mint === undefined){
        return;
      }

      let existingData = [];
      try {
        const existingContent = fs.readFileSync(addressesToExcludeJsonPath, 'utf8');
        existingData = JSON.parse(existingContent);
      } catch (readError) {
      }
      
      existingData.push(passedToken);

      const jsonData = JSON.stringify(existingData, null, 2);

      fs.writeFile(addressesToExcludeJsonPath, jsonData, 'utf8', (err : NodeJS.ErrnoException) => {
        if (err) {
          console.error('Error writing to file:', err);
        } 
      });
    }
    else{
      const formattedDate = dateFromTimestamp.tz('Europe/Sofia').format('YYYY-MM-DD HH:mm:ss'); // Use 'Europe/Sofia' for Bulgarian time
      console.log(`${matchingToken?.name} pool with base mint address ${poolKeys.baseMint.toString()} opens at: ${formattedDate}`);
    }
  } catch (error) {
    console.error("Error fetching liquidity pools information:", error);
  }
}

async function get_new_tokens() {
  const connection = new Connection("https://api.mainnet-beta.solana.com");

  await load_raydium_tokens();
  await load_raydium_token_pools();
  await remove_old_tokens();

  for (const poolKeys of allPools) {
    await get_pool_info(connection, poolKeys);
  };

  get_new_tokens();
}

get_new_tokens();
