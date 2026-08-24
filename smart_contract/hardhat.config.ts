import { configVariable, defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";


export default defineConfig({
  plugins: [hardhatEthers],
  solidity: {
    version: "0.8.19",
    settings: {
      //evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    "testnet": {
      type: "http",
      url: "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: [configVariable("PRIVATE_KEY")]
    },
    "mainnet": {
      type: "http",
      url: "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: [configVariable("PRIVATE_KEY")]
    }
  }
});
