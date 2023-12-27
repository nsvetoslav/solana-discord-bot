import { PublicKeyish, Token } from "@raydium-io/raydium-sdk";

export class TokenMetadata {
    public tokenName : string;
    public tokenSymbol : string;
    public tokenLogo : string;

    public constructor(_tokenName : string, _tokenSymbol: string, _tokenLogo: string){
        this.tokenLogo = _tokenLogo;
        this.tokenName = _tokenName;
        this.tokenSymbol = _tokenSymbol;
    }
}

export class ExtendedToken extends Token{
    public icon: string 
  
    public constructor(_icon : string,
      _programId: PublicKeyish,
      _mint: PublicKeyish,
      _decimals: number,
      _symbol = 'UNKNOWN',
      _name = 'UNKNOWN')
    {
      super(_programId, _mint, _decimals, _symbol, _name)
      this.icon = _icon
    }
}