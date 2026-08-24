# AddressStorage Contract

A simple smart contract for storing metadata references (address/index blocks) of files uploaded to 0G Storage, acting as a lightweight on-chain registry.

## Overview

The `AddressStorage` contract enables a single owner to store and retrieve arbitrary byte data, designed to hold references (like index block addresses) for files stored on the 0G Storage network. Each entry is automatically timestamped with the block timestamp upon addition.

## Deployed Addresses

| Network | Contract Address | Explorer |
|---------|------------------|----------|
| **Mainnet** | `0xbFF753fd372784945C937fAd511E2E529184f2E0` | [View on 0G Chainscan](https://chainscan.0g.ai/address/0xbff753fd372784945c937fad511e2e529184f2e0) |
| **Testnet (Galileo)** | `0xc372931820Ce07D94d8D9650fa0d815b9947A89f` | [View on 0G Galileo Chainscan](https://chainscan-galileo.0g.ai/address/0xc372931820ce07d94d8d9650fa0d815b9947a89f) |

> **Note:** The explorer links provide full transaction history, source code verification, and read/write contract interaction capabilities.

## How to Deploy

Install dependencies:

```bash
npm install
```


Deploy on testnet:

```bash
PRIVATE_KEY=0xPRIVATE_KEY npx hardhat run scripts/deploy.js --network  testnet 
```


Deploy on mainnet:

```bash
PRIVATE_KEY=0xPRIVATE_KEY npx hardhat run scripts/deploy.js --network  mainnet 
```

## Features

- **Owner-Only Access**: Only the contract deployer can add new entries.
- **Data Storage**: Stores arbitrary byte arrays (`bytes`), ideal for 0G storage index block addresses or file metadata.
- **Timestamps**: Each entry is automatically tagged with `block.timestamp` for chronological tracking.
- **Full Retrieval**: View all stored data and timestamps via `getAllEntries()`.

## Usage

### Adding Data
```solidity
// Call as owner only
function addData(bytes memory _data) public onlyOwner
```
- Requires non-empty data.
- Pushes `_data` to `dataList` and current block timestamp to `timestampList`.

### Viewing All Entries
```solidity
function getAllEntries() public view returns (bytes[] memory, uint256[] memory)
```
- Returns two parallel arrays: one for stored bytes data, one for corresponding timestamps.

## Integration with 0G Storage

This contract is designed to work with the **0G Storage network** by storing the index block address (a unique identifier) returned when uploading an encrypted chunk of file. The typical flow is:

1. **Receive file**: Accept a file from the user.
2. **Chunk and encrypt**: Divide the file into chunks, encrypt each chunk, and upload each encrypted chunk to 0G Storage to obtain the root hash of each added block.
3. **Create index block**: Collect all block root hashes, encrypt them collectively, and upload this encrypted data as an index (directory) block to 0G Storage.
4. **Upload index block**: Submit the encrypted index block to 0G Storage and receive its index block address.
5. **Store on-chain**: Call `addData()` with the index block address as the `_data` parameter to permanently record it on-chain.
6. **Retrieve and download**: Later, retrieve the stored index block addresses via `getAllEntries()` to locate and download files from 0G Storage.

The `bytes` type can hold either raw bytes or be cast to an `address` if needed, making it flexible for various storage reference formats.

## License

MIT
