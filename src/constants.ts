import { LiquidityPoolKeys } from "@raydium-io/raydium-sdk";
import { ExtendedToken } from "./types";

class constants {
  public solana_endpoint : string = "https://api.mainnet-beta.solana.com";
  public opened_pools = './files/openedPools.json'
  public sent_pools = './files/sentPools.json';
  public raydium_tokens_endpoint = 'https://api.raydium.io/v2/sdk/token/raydium.mainnet.json';
  public raydium_liquidity_endpoint = 'https://api.raydium.io/v2/sdk/liquidity/mainnet.json';
};

export let defines : constants = new constants();
export const fs = require('fs');
export const moment = require('moment-timezone');

export async function sleep() {
  return new Promise(resolve => setTimeout(resolve, 350));
}
