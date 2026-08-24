# Enterprise AI Vault

**Store your files on 0G decentralized storage, then chat with them using AI — with every reference anchored on-chain.**

Enterprise AI Vault lets a user upload a text document, which is chunked, encrypted, and stored on the 0G Storage Network; a semantic search layer indexes the chunks; and a chat interface answers questions about the document using the 0G AI Router, pulling only the relevant chunks back from decentralized storage on demand.

🔗 **Live demo:** [eav.buildlabz.xyz](https://eav.buildlabz.xyz/)
🔗 **Repo:** [github.com/build-labz/Enterprise-AI-Vault](https://github.com/build-labz/Enterprise-AI-Vault)

---

## What problem this solves

Retrieval-augmented AI systems typically keep source documents and their embeddings in centralized, provider-owned storage — a single point of failure, a black box for auditability, and a trust bottleneck for enterprise data. Enterprise AI Vault replaces that with a **decentralized, verifiable storage layer**: every chunk of a document is encrypted and pushed to 0G Storage, and the address of the full document index is anchored to a smart contract on 0G Chain, so anyone can verify what was stored and when — without trusting a central server.

## What it does

1. **Upload** — a user submits a text file (max 10MB) through the web interface.
2. **Chunk & encrypt** — the file is split into ~4096-character chunks along sentence boundaries, and each chunk is ECIES-encrypted.
3. **Store on 0G** — each encrypted chunk is uploaded to the 0G Storage Network via the indexer, returning a Merkle root hash per chunk.
4. **Anchor on-chain** — the full chunk index (mapping chunks → hashes) is itself uploaded to 0G Storage, and its root hash is written to the `AddressStorage` smart contract on 0G mainnet, creating a permanent, verifiable on-chain reference.
5. **Index for search** — each chunk is also sent to a vector-search service, which embeds it (Sentence Transformers) and indexes it (FAISS) for semantic retrieval.
6. **Chat** — when a user asks a question, the query is embedded and matched against the index; the top matching chunk(s) are pulled back from 0G Storage (decrypted on retrieval) and passed as context to the **0G AI Router**, which generates the final answer.

## 0G components used

| Component | Role in this project |
|---|---|
| **0G Storage Network** (Indexer + Turbo endpoint) | Stores every encrypted file chunk and the chunk index, with Merkle proof verification on upload/download |
| **0G Chain (Mainnet)** | Hosts the `AddressStorage` smart contract that anchors the root hash of every chunk index on-chain |
| **0G AI Router** | Serves the LLM (`0gm-1.0-35b-a3b`) used to answer user queries against retrieved chunk content |

### On-chain proof

- **Contract (AddressStorage):** [`0xbFF753fd372784945C937fAd511E2E529184f2E0`](https://chainscan.0g.ai/address/0xbff753fd372784945c937fad511e2e529184f2e0) — 0G Mainnet
- **Explorer:** view stored index-block references and timestamps directly via the contract's `getAllEntries()` read call on [0G Chainscan](https://chainscan.0g.ai/address/0xbff753fd372784945c937fad511e2e529184f2e0)
- Each successful `/upload` writes a new entry to this contract, timestamped with `block.timestamp`

## Architecture

```
┌───────────────────────────────┐
│   Client Browser               │
│   (main_service/public)        │
│   also live at eav.buildlabz.xyz│
└──────────────┬─────────────────┘
               │
               ▼
┌───────────────────────────────────────────┐
│   main_service (Node.js / Express, :3000)  │
│   - POST /upload  → chunk, encrypt, store  │
│   - POST /chat    → search + AI response   │
└──────┬───────────────────────────┬─────────┘
       │                           │
       ▼                           ▼
┌─────────────────────────┐  ┌──────────────────────────────┐
│ vector-search-service    │  │ 0G Storage Network            │
│ (Python / Flask, :8080)  │  │ - Indexer (turbo endpoint)     │
│ - /process_chunks        │  │ - Encrypted chunk storage      │
│ - /search                │  │ - Merkle proof verification    │
│ FAISS + SQLite +         │  └───────────────┬────────────────┘
│ Sentence Transformers    │                  │
└───────────────────────────┘                  ▼
                                     ┌──────────────────────────┐
                                     │ AddressStorage contract   │
                                     │ 0G Mainnet                │
                                     │ anchors chunk-index hash  │
                                     └──────────────────────────┘

main_service also calls the 0G AI Router (router-api.0g.ai)
with retrieved chunk content + the user's query to generate answers.
```

## Repository structure

This is a monorepo with three sub-projects, each independently deployable:

```
Enterprise-AI-Vault/
├── main_service/            # Node.js/Express server + web UI (upload & chat)
│   ├── server.js
│   ├── 0g-utils.js          # 0G Storage upload/download + smart contract calls
│   ├── text-utils.js        # Sentence-aware text chunking
│   └── public/index.html
├── vector-search-service/   # Python/Flask semantic search API
│   ├── main.py
│   └── requirements.txt
└── smart_contract/ # Solidity contract + deploy scripts
    ├── contracts/AddressStorage.sol
    └── scripts/deploy.js
```

| Sub-project | Purpose | Stack |
|---|---|---|
| [`main_service`](./main_service) | Upload/chunk/encrypt/store files, orchestrate chat, call 0G AI Router | Node.js, Express, `@0gfoundation/0g-storage-ts-sdk`, ethers.js |
| [`vector-search-service`](./vector-search-service) | Embed and semantically search stored chunks | Python, Flask, FAISS, Sentence Transformers |
| [`smart_contract`](./smart_contract) | On-chain registry anchoring chunk-index hashes | Solidity, Hardhat |

## Local deployment / reproduction steps

### Prerequisites

- Node.js v22+
- Python 3.12+
- A 0G account with a funded private key
- An API key for the 0G AI Router

### 1. Clone

```bash
git clone https://github.com/build-labz/Enterprise-AI-Vault.git
cd Enterprise-AI-Vault
```

### 2. Start the vector search service

```bash
cd vector-search-service
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Runs on `http://127.0.0.1:8080`.

### 3. Start the main service

```bash
cd ../main_service
npm install
```

Create a `.env` file in `main_service/`:

```env
API_KEY=your_0g_ai_router_api_key
PRIVATE_KEY=your_0g_wallet_private_key
```

```bash
node server.js
```

Runs on `http://localhost:3000`.

### 4. Try it

```bash
# Upload a text file
curl -X POST -F "file=@test.txt" http://localhost:3000/upload

# Ask a question about it
curl -X POST -H "Content-Type: application/json" \
  -d '{"text":"What is in the uploaded file?"}' \
  http://localhost:3000/chat
```

Or just open [http://localhost:3000](http://localhost:3000) (or the hosted demo at [eav.buildlabz.xyz](https://eav.buildlabz.xyz/)).

### 5. (Optional) Deploy your own AddressStorage contract

```bash
cd ../address-storage-contract
npm install
PRIVATE_KEY=0xYOUR_KEY npx hardhat run scripts/deploy.js --network mainnet
```

## Configuration reference

- **0G Chain RPC:** `https://evmrpc.0g.ai`
- **0G Storage Indexer:** `https://indexer-storage-turbo.0g.ai`
- **AddressStorage contract (mainnet):** `0xbFF753fd372784945C937fAd511E2E529184f2E0`
- **0G AI Router:** `https://router-api.0g.ai/v1`, model `0gm-1.0-35b-a3b`
- Testnet (Galileo) equivalents are available and documented in each sub-project's README.

## Video

📺 [https://www.youtube.com/watch?v=YhE2h9Fs-Mo](Youtube Video)

## Public post

🐦 [https://x.com/buildlabz/status/2091993829536571395](x.com post)

## License

MIT
