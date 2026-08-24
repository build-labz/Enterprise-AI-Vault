# 0G AI Storage & Chat Server

A complete server implementation that integrates file storage on the 0G decentralized storage network with AI-powered querying capabilities. This system allows users to upload text files, split them into chunks, store them on 0G Storage Network, and then query the stored content using an AI assistant.

## Overview

This project provides a web-based interface for:
1. **Uploading text files** (max 10MB) and automatically splitting them into manageable chunks
2. **Storing chunks** on the 0G decentralized storage network
3. **Maintaining a chunk index** for efficient retrieval
4. **AI-powered querying** of stored content using the 0G AI router

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                          │
│                    (public/index.html)                         │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express Server (port 3000)                  │
│                      server.js                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  /upload    - File upload & chunking endpoint            │ │
│  │  /chat      - AI query endpoint                         │ │
│  │  /          - Serves HTML interface                     │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Python Processing Server (port 8080)              │
│          (External - handles chunk processing/search)          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  /process_chunks  - Processes uploaded chunks            │ │
│  │  /search          - Searches for relevant chunks         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    0G Decentralized Storage                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Indexer (https://indexer-storage-turbo.0g.ai)          │ │
│  │  - Stores file chunks                                   │ │
│  │  - Stores chunk index                                   │ │
│  │  - Merkle tree verification                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Smart Contract (0xbFF753fd372784945C937fAd511E2E529184f2E0)│ │
│  │  - Stores root hash references                         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **File Upload Flow:**
   - User selects a text file through the web interface
   - Server receives the file and splits it into chunks (target size: 4096 characters)
   - Each chunk is uploaded to 0G Storage Network with encryption
   - A chunk index (JSON mapping chunks to hashes) is created and stored
   - The root hash of the chunk index is saved to the smart contract
   - Each chunk is sent to the Python processing server

2. **Query Flow:**
   - User submits a query through the chat interface
   - Server sends the query to the Python processing server for search
   - Python server returns relevant chunk hashes
   - Server downloads chunks from 0G Storage Network
   - The retrieved content is sent to the 0G AI router along with the query
   - AI response is returned to the user

## Prerequisites

- Node.js (v22 or later)
- Python 3.12 (for vector-search-service)
- 0G Account with private key
- API key for 0G AI router

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/build-labz/Enterprise-AI-Vault.git
cd Enterprise-AI-Vault/main_service
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Rename the `env` file as `.env`  in the root directory:

```env
# 0G Configuration
API_KEY=your_api_key_here
PRIVATE_KEY=your_private_key_here
```

### 4. Start the Python Processing Server

The server expects a Python service running on port 8080 with endpoints:
- `POST /process_chunks` - Processes uploaded chunks
- `POST /search` - Searches for relevant chunks

### 5. Start the Node.js Server

```bash
node server.js
```

The server will start on `http://localhost:3000`

## File Structure

```
webjs/
├── server.js                 # Main Express server
├── 0g-utils.js              # 0G storage utilities
├── text-utils.js            # Text splitting utilities
├── package.json             # NPM dependencies
├── .env                     # Environment variables (create this)
└── public/
    └── index.html           # Web interface
```

## API Endpoints

### GET /
Serves the web interface HTML file.

### POST /upload
Uploads a text file for storage on 0G Network.

**Request:**
- `multipart/form-data` with field name `file`
- Maximum file size: 10MB

**Response:**
```json
{
  "message": "File uploaded successfully",
  "filename": "example.txt",
  "size": 12345,
  "total_chunks": 5,
  "root_hash_of_chunk_index": "0x...",
  "all_chunks_data": [
    {
      "filename": "example.txt",
      "chunk_number": 0,
      "chunk_hash": "0x..."
    }
  ]
}
```

### POST /chat
Send a query to search and interact with stored content.

**Request:**
```json
{
  "text": "Your query here"
}
```

**Response:**
```json
{
  "received": "Your query here",
  "response": "AI assistant response based on stored content",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Core Components

### 1. server.js
The main Express server handling HTTP requests, file uploads, and routing. It integrates with the 0G AI router for intelligent responses.

### 2. 0g-utils.js
Utility functions for interacting with the 0G Storage Network:
- `uploadString()`: Upload string data to 0G storage
- `downloadFromIndexerToBlob()`: Download data from 0G storage
- `saveRootHashInSmartContract()`: Store references on the blockchain

### 3. text-utils.js
Contains the text splitting logic:
- `splitTextAtSentencesAdvanced()`: Splits text into chunks based on sentence boundaries with a target size of 4096 characters

## Configuration

### 0G Network Settings

The application uses:
- **Mainnet RPC**: `https://evmrpc.0g.ai`
- **Indexer**: `https://indexer-storage-turbo.0g.ai`
- **Contract**: `0xbFF753fd372784945C937fAd511E2E529184f2E0`

For testnet, uncomment the testnet configuration in `0g-utils.js`.

### File Chunking

- Target chunk size: 4096 characters
- Splitting algorithm respects sentence boundaries
- Each chunk is independently encrypted and stored

### AI Integration

- Uses 0G AI Router endpoint: `https://router-api.0g.ai/v1`
- Model: `0gm-1.0-35b-a3b`
- Chat template with thinking disabled

## Security Considerations

1. **Private Key**: Store your private key securely in the `.env` file
2. **API Key**: Keep your 0G AI API key confidential
3. **File Validation**: The server validates file types and sizes
4. **Encryption**: Files are encrypted using ECIES encryption before storage

## Troubleshooting

### Common Issues

1. **File Upload Fails**
   - Check file size (max 10MB)
   - Ensure file is plain text
   - Verify server has write permissions

2. **Python Server Not Responding**
   - Ensure Python server is running on port 8080
   - Check if both `/process_chunks` and `/search` endpoints are implemented

3. **0G Storage Errors**
   - Verify your private key is correct
   - Check RPC connectivity
   - Ensure sufficient funds for storage transactions

4. **AI Router Issues**
   - Validate your API key
   - Check network connectivity to `router-api.0g.ai`

## Development

### Adding New Features

1. **Additional File Types**: Modify the `upload` endpoint to support more formats
2. **Custom Chunk Sizes**: Adjust the `targetLength` parameter in `text-utils.js`
3. **Alternative AI Models**: Change the `model` field in the chat completion request

### Testing

```bash
# Test file upload
curl -X POST -F "file=@test.txt" http://localhost:3000/upload

# Test chat endpoint
curl -X POST -H "Content-Type: application/json" -d '{"text":"What is in the uploaded file?"}' http://localhost:3000/chat
```

## Dependencies

### Production
- `@0gfoundation/0g-storage-ts-sdk`: 0G Storage Network SDK
- `ethers`: Ethereum blockchain interaction
- `express`: Web server framework
- `multer`: File upload handling
- `openai`: OpenAI/0G AI API client

### Development
- Node.js runtime
- NPM package manager

## License

MIT

## Support

For issues and questions:
- 0G Documentation: [https://docs.0g.ai](https://docs.0g.ai)
- GitHub Issues: Create an issue in the repository

---

**Note**: This server requires the vector-search-service to handle chunk processing and search functionality. 
