import {
  Liquidity,
  LiquidityPoolInfo,
  LiquidityPoolKeys
} from "@raydium-io/raydium-sdk";
import {
  Connection,
  Keypair
} from "@solana/web3.js";
import {
  jsonInfo2PoolKeys
} from "@raydium-io/raydium-sdk";
import dotenv from "dotenv";
import {
  Currency,
  CurrencyAmount,
  Percent,
  Token,
  TokenAmount
} from "@raydium-io/raydium-sdk";
import {
  Spl
} from "@raydium-io/raydium-sdk";
import { token } from "@coral-xyz/anchor/dist/cjs/utils";
const moment = require('moment-timezone');
const currentDate = moment();

async function sleep() {
  return new Promise(resolve => setTimeout(resolve, 350));
}

interface TokenInterface {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  extensions?: { coingeckoId: string };
  icon: string;
  hasFreeze: number;
}

async function get_token_liquidity_start_date() {

  const RAYDIUM_LIQUIDITY_JSON = 'https://api.raydium.io/v2/sdk/liquidity/mainnet.json';
  const RAYDIUM_TOKEN_JSON = 'https://api.raydium.io/v2/sdk/token/raydium.mainnet.json';

  let tokensData;
  try {
    const response_tokens = await fetch(RAYDIUM_TOKEN_JSON);
    if (response_tokens.status == 200) {
      tokensData = await response_tokens.json();
    } else {
      console.error('Failed to load Raydium tokens data');
    }
  } catch (error) {
    console.error('Failed to load Raydium tokens data');
  }

  // Convert the array of unofficial tokens to an array of the specified interface
  const allTokens: Token[] = (tokensData?.unOfficial.concat(tokensData?.official) || []).map((tokenObject: any) => {
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

  let raydiumPoolsData;
  try {
    const response = await fetch(RAYDIUM_LIQUIDITY_JSON);
    if (response.status == 200) {
      raydiumPoolsData = await response.json();
    } else {
      console.error('Failed to load Raydium pools data');
    }
  } catch (error) {
    console.error('Error loading Raydium pools data:', error);
  }

  const allPools =raydiumPoolsData.official.concat(raydiumPoolsData.unOfficial); 

  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const poolKeysArray = await Promise.all(
    allPools.map((poolData: LiquidityPoolKeys) => jsonInfo2PoolKeys(poolData))
  );

  for (const poolKeys of poolKeysArray) {
    await sleep();

    try {
      const poolsInfo = await Liquidity.fetchInfo({
        connection,
        poolKeys,
      });

      const matchingToken = await allTokens.find(token => token.mint === poolKeys.baseMint.toString());
      const dateFromTimestamp = moment.unix(poolsInfo.startTime.toNumber());
      
      if (dateFromTimestamp.isAfter(currentDate, 'minute')) {
        const formattedDate = dateFromTimestamp.tz('Europe/Sofia').format('YYYY-MM-DD HH:mm:ss'); // Use 'Europe/Sofia' for Bulgarian time
        console.log(`The pool of token ${matchingToken?.name} with base mint address ${poolKeys.baseMint.toString()} opens at: ${formattedDate}`);
      }

    } catch (error) {
      console.error("Error fetching liquidity pools information:", error);
    }
  };
}

get_token_liquidity_start_date();