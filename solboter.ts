import {
  LIQUIDITY_STATE_LAYOUT_V4,
  Liquidity,
  LiquidityPoolKeys,
  PublicKeyish,  
  SPL_ACCOUNT_LAYOUT,  
  SPL_MINT_LAYOUT,
  TOKEN_PROGRAM_ID,
  TokenAccount
} from "@raydium-io/raydium-sdk";

import {
  Connection,
  PublicKey,
  TokenAccountsFilter,
  sendAndConfirmTransaction
} from "@solana/web3.js";

import {
  jsonInfo2PoolKeys
} from "@raydium-io/raydium-sdk";

import {
  Token,
} from "@raydium-io/raydium-sdk";

import { 
  TextBasedChannel 
} from 'discord.js';

import { Metaplex } from "@metaplex-foundation/js";
import { ENV, TokenListProvider } from "@solana/spl-token-registry";
import { OpenOrders } from "@project-serum/serum";

class TokenMetadata {
  public tokenName : string;
  public tokenSymbol : string;
  public tokenLogo : string;

  public constructor(_tokenName : string, _tokenSymbol: string, _tokenLogo: string){
    this.tokenLogo = _tokenLogo;
    this.tokenName = _tokenName;
    this.tokenSymbol = _tokenSymbol;
  }
}

async function getTokenMetadata1(key : string) {
  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const metaplex = Metaplex.make(connection);

  const mintAddress = new PublicKey(key);

  var tokenName = '';
  let tokenSymbol = '';
  let tokenLogo = '';

  const metadataAccount = metaplex
      .nfts()
      .pdas()
      .metadata({ mint: mintAddress });

  const metadataAccountInfo = await connection.getAccountInfo(metadataAccount);

  if (metadataAccountInfo) {
        const token = await metaplex.nfts().findByMint({ mintAddress: mintAddress });
        tokenName = token.name;
        tokenSymbol = token.symbol;
        tokenLogo = token.json?.image || '';
  }

  let value : TokenMetadata = new TokenMetadata(tokenName , tokenSymbol, tokenLogo);
  return value;
}

async function getTokenMetadata2(key : string) {
  const mintAddress = new PublicKey(key);

  var tokenName = '';
  let tokenSymbol = '';
  let tokenLogo = '';


  const provider = await new TokenListProvider().resolve();
  const tokenList = provider.filterByChainId(ENV.MainnetBeta).getList();
  const tokenMap = tokenList.reduce((map, item) => {
      map.set(item.address, item);
          return map;
      }, new Map());

  const token = tokenMap.get(mintAddress.toBase58());
  tokenName = token.name;
  tokenSymbol = token.symbol;
  tokenLogo = token.logoURI;

  let value : TokenMetadata = new TokenMetadata(tokenName , tokenSymbol, tokenLogo);
  return value;
}

const fs = require('fs');
const moment = require('moment-timezone');
const addressesToExcludeJsonPath = 'exludeAddresses.json'

class CustomToken extends Token{
  public icon: string 

  public constructor(_icon : string,
    _programId: PublicKeyish,
    _mint: PublicKeyish,
    _decimals: number,
    _symbol = 'UNKNOWN',
    _name = 'UNKNOWN',
){
    super(_programId, _mint, _decimals, _symbol, _name)
    this.icon = _icon
  }
}

import { readFileSync, writeFile } from 'fs';
import { BN } from "@coral-xyz/anchor";

let allPools: LiquidityPoolKeys[];
let allTokens : CustomToken[];

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

async function is_already_sent_in_discord(mintAddr : string) {
  const sent_to_discord_file = 'sentToDiscord.json';
  let sentTokens: any[] = [];

  try {
    const jsonContent = fs.readFileSync(sent_to_discord_file, 'utf8');
    sentTokens = JSON.parse(jsonContent);
    // Ensure sentTokens is an array
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
    fs.writeFile(sent_to_discord_file, newJsonData, 'utf8', (err : NodeJS.ErrnoException) => {
      if (err) {
        console.error('Error writing to file:', err);
      } 
    });
    return false;
  }

  return true;
}

async function get_pool_info(connection: Connection, poolKeys : any, channel : TextBasedChannel) {
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
        mintAddress: matchingToken?.mint.toString()
      };

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
      const differenceInMinutes = dateFromTimestamp.diff(currentDate, 'minutes');
      if(differenceInMinutes > 30){
        return;
      }

      if(await is_already_sent_in_discord(matchingToken.mint.toString())){
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
          res = await getTokenMetadata2(matchingToken.mint.toString());
      }
      catch (error){
        try{
          res = await getTokenMetadata1(matchingToken.mint.toString());
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

      // try{
      //   get_liquidity_pool_prices(connection, poolKeys.id, poolKeys.baseMint);
      // } catch(err){
      // }
  
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

      channel.send(messageOptions);
    }
  } catch (error) {
    console.error("Error fetching liquidity pools information:", error);
  }
}


export async function get_new_tokens(channel : TextBasedChannel) {
  const connection = new Connection("https://api.mainnet-beta.solana.com", 'confirmed');

  try {
  await load_raydium_tokens();
  await load_raydium_token_pools();
  await remove_old_tokens();

  for (const poolKeys of allPools) {        
    await get_pool_info(connection, poolKeys, channel);
  };
}
catch{    
}

get_new_tokens(channel);
}

async function getTokenAccountss(connection: Connection, owner: PublicKey) {
  const tokenResp = await connection.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const accounts: TokenAccount[] = [];
  for (const { pubkey, account } of tokenResp.value) {
    accounts.push({
      pubkey,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
      programId: new PublicKey(TOKEN_PROGRAM_ID)
    });
  }

  return accounts;
}

// raydium pool id can get from api: https://api.raydium.io/v2/sdk/liquidity/mainnet.json
const SOL_USDC_POOL_ID = "EKzonEpyzPfvP8iS6cTsouwsp3SCCwvnSqTMAbDCAAb9";
const OPENBOOK_PROGRAM_ID = new PublicKey(
  "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"
);

export async function parsePoolInfo() {
  const connection = new Connection("https://api.mainnet-beta.solana.com", 'confirmed');
  const owner = new PublicKey("srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX");

  const tokenAccounts = await getTokenAccountss(connection, owner);

  // example to get pool info
  const info = await connection.getAccountInfo(new PublicKey(SOL_USDC_POOL_ID));
  if (!info) return;

  const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);
  const openOrders = await OpenOrders.load(
    connection,
    poolState.openOrders,
    OPENBOOK_PROGRAM_ID // OPENBOOK_PROGRAM_ID(marketProgramId) of each pool can get from api: https://api.raydium.io/v2/sdk/liquidity/mainnet.json
  );

  const baseDecimal = 10 ** poolState.baseDecimal.toNumber(); // e.g. 10 ^ 6
  const quoteDecimal = 10 ** poolState.quoteDecimal.toNumber();

  const baseTokenAmount = await connection.getTokenAccountBalance(
    poolState.baseVault
  );
  const quoteTokenAmount = await connection.getTokenAccountBalance(
    poolState.quoteVault
  );

  const basePnl = poolState.baseNeedTakePnl.toNumber() / baseDecimal;
  const quotePnl = poolState.quoteNeedTakePnl.toNumber() / quoteDecimal;

  const openOrdersBaseTokenTotal =
    openOrders.baseTokenTotal.toNumber() / baseDecimal;
  const openOrdersQuoteTokenTotal =
    openOrders.quoteTokenTotal.toNumber() / quoteDecimal;

  const base =
    (baseTokenAmount.value?.uiAmount || 0) + openOrdersBaseTokenTotal - basePnl;
  const quote =
    (quoteTokenAmount.value?.uiAmount || 0) +
    openOrdersQuoteTokenTotal -
    quotePnl;

  const denominator = new BN(10).pow(poolState.baseDecimal);

  const addedLpAccount = tokenAccounts.find((a) =>
    a.accountInfo.mint.equals(poolState.lpMint)
  );

  console.log(
    "SOL_USDC pool info:",
    "pool total base " + base,
    "pool total quote " + quote,

    "base vault balance " + baseTokenAmount.value.uiAmount,
    "quote vault balance " + quoteTokenAmount.value.uiAmount,

    "base tokens in openorders " + openOrdersBaseTokenTotal,
    "quote tokens in openorders  " + openOrdersQuoteTokenTotal,

    "base token decimals " + poolState.baseDecimal.toNumber(),
    "quote token decimals " + poolState.quoteDecimal.toNumber(),
    "total lp " + poolState.lpReserve.div(denominator).toString(),

    "addedLpAmount " +
      (addedLpAccount?.accountInfo.amount.toNumber() || 0) / baseDecimal
  );
}

