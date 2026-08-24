import { ZgFile, Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk';
import { ethers } from 'ethers';



const RPC_URL =  'https://evmrpc.0g.ai';
const INDEXER_RPC = 'https://indexer-storage-turbo.0g.ai';
const contractAddress = "0xbFF753fd372784945C937fAd511E2E529184f2E0";

// const RPC_URL = 'https://evmrpc-testnet.0g.ai';
// const INDEXER_RPC = 'https://indexer-storage-testnet-turbo.0g.ai';
// const contractAddress = "0xc372931820Ce07D94d8D9650fa0d815b9947A89f";


// Initialize provider and signer
const privateKey = process.env.PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(privateKey, provider);

// Initialize indexer — flow contract is auto-discovered
const indexer = new Indexer(INDEXER_RPC);


const wallet = new ethers.Wallet(privateKey, provider);
const recipientPubKey = ethers.SigningKey.computePublicKey(
    wallet.signingKey.publicKey, true  // true = compressed 33-byte key
);




async function uploadFile(filePath) {
    const file = await ZgFile.fromFilePath(filePath);

    // Must call merkleTree() before upload — populates internal state
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr !== null) throw new Error(`Merkle tree error: ${treeErr}`);

    console.log("Root Hash:", tree?.rootHash());

    const [tx, uploadErr] = await indexer.upload(file, RPC_URL, signer, {
        encryption: { type: 'ecies', recipientPubKey },
    });
    if (uploadErr !== null) throw new Error(`Upload error: ${uploadErr}`);

    await file.close(); // Always close when done

    // Handle both single and fragmented (>4GB) responses
    if ('rootHash' in tx) {
        return { rootHash: tx.rootHash, txHash: tx.txHash };
    } else {
        return { rootHashes: tx.rootHashes, txHashes: tx.txHashes };
    }
}

async function uploadString(str) {
    const data = new TextEncoder().encode(str);
    const memData = new MemData(data);

    // Must call merkleTree() before upload — populates internal state
    const [tree, treeErr] = await memData.merkleTree();
    if (treeErr !== null) throw new Error(`Merkle tree error: ${treeErr}`);

    console.log("Root Hash:", tree?.rootHash());

    const [tx, uploadErr] = await indexer.upload(memData, RPC_URL, signer, {
        encryption: { type: 'ecies', recipientPubKey },
    });
    if (uploadErr !== null) throw new Error(`Upload error: ${uploadErr}`);

    return tx.rootHash;
}


async function downloadFromIndexer(rootHash, outputPath) {
    // withProof = true enables Merkle proof verification
    const err = await indexer.download(rootHash, outputPath, true);
    if (err !== null) {
        console.error(`Download error: ${err}`);
        return;
    }
    console.log("Download successful!");
}

async function downloadFromIndexerToBlob(rootHash) {
    // withProof = true enables Merkle proof verification
    const [blob, dlErr] = await indexer.downloadToBlob(rootHash, {
        proof: true,
        decryption: { privateKey },
    });
    if (dlErr !== null) {
        throw new Error(`Download error: ${dlErr}`);
    }
    return blob;
}


async function saveRootHashInSmartContract(rootHash){
    const abi = [
        "function addData(bytes memory _data) public",
        "function getAllEntries() public view returns (bytes[] memory, uint256[] memory)",
        "function dataList(uint256) public view returns (bytes memory)",
        "function timestampList(uint256) public view returns (uint256)",
        "function getCount() public view returns (uint256)",
        "function owner() public view returns (address)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, signer);
    const tx = await contract.addData(rootHash);
    await tx.wait();
}


export {
  downloadFromIndexer,
  downloadFromIndexerToBlob,
  uploadFile,
  uploadString,
  saveRootHashInSmartContract,
};