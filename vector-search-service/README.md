# Vector Search Service

A high-performance REST API service for storing and searching text embeddings using FAISS (Facebook AI Similarity Search) and Sentence Transformers.

## Overview

This service provides vector-based semantic search capabilities using:
- **Sentence Transformers**: For generating text embeddings using the `all-MiniLM-L6-v2` model (384-dimensional embeddings)
- **FAISS**: For efficient similarity search at scale
- **SQLite**: For metadata storage and management
- **Flask**: For REST API endpoints

## Features

- **Store Text Chunks**: Process and store text chunks with their embeddings
- **Semantic Search**: Find similar text chunks using cosine similarity
- **Filtered Search**: Search with filename filters
- **CRUD Operations**: Create, Read, and Delete chunks by hash
- **Persistence**: Automatic saving of index and metadata to disk
- **Statistics**: View index statistics and health status

## Installation

### Prerequisites

- Python 3.7 or higher
- pip (Python package manager)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/build-labz/Enterprise-AI-Vault.git
cd Enterprise-AI-Vault/vector-search-service
```

2. Create a virtual environment (optional but recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the service:
```bash
python app.py
```

The service will start on `http://127.0.0.1:8080`

## API Endpoints

### 1. Store a Text Chunk
**POST** `/process_chunks`

Store a text chunk with its embedding for future searches.

**Request Body:**
```json
{
    "filename": "document.txt",
    "chunk_number": 1,
    "chunk_content": "This is the text content of the chunk",
    "chunk_hash": "root_hash_from_0g_storage"
}
```

**Response:**
```json
{
    "status": "success",
    "message": "Stored chunk 1 from document.txt",
    "chunk_hash": "root_hash_from_0g_storage",
    "total_chunks": 1
}
```

### 2. Search for Similar Chunks
**POST** `/search`

Search for chunks similar to a query text.

**Request Body:**
```json
{
    "query": "Your search query text",
    "top_k": 5  // Optional, defaults to 5
}
```

**Response:**
```json
{
    "query": "Your search query text",
    "total_results": 3,
    "results": [
        {
            "filename": "document.txt",
            "chunk_number": 1,
            "chunk_hash": "root_hash_from_0g_storage",
            "similarity_score": 0.85
        }
    ]
}
```

### 3. Search with Filename Filter
**POST** `/search/filter`

Search for similar chunks with an optional filename filter.

**Request Body:**
```json
{
    "query": "Your search query text",
    "top_k": 5,  // Optional, defaults to 5
    "filename": "specific_file.txt"  // Optional filter
}
```

### 4. Get Chunk by Hash
**GET** `/get_chunk/<chunk_hash>`

Retrieve metadata for a specific chunk by its hash.

**Response:**
```json
{
    "chunk_hash": "root_hash_from_0g_storage",
    "filename": "document.txt",
    "chunk_number": 1,
    "created_at": "2024-01-01 12:00:00.000000"
}
```

### 5. Delete a Chunk
**DELETE** `/delete/<chunk_hash>`

Delete a chunk and its embedding from the index.

**Response:**
```json
{
    "status": "success",
    "message": "Deleted chunk with hash root_hash_from_0g_storage"
}
```

### 6. Get Statistics
**GET** `/stats`

Get statistics about the index.

**Response:**
```json
{
    "total_chunks": 100,
    "embedding_dimension": 384,
    "unique_files": 5,
    "hash_to_id_size": 100
}
```

### 7. Health Check
**GET** `/health`

Check if the service is running.

**Response:**
```json
{
    "status": "healthy",
    "total_chunks": 100
}
```

## Data Persistence

The service automatically persists data to disk:
- `faiss_index.bin`: FAISS vector index
- `embeddings.db`: SQLite database containing chunk metadata
- `hash_mapping.json`: Mapping between chunk hashes and FAISS IDs

All files are created in the same directory as the application.

## Usage Examples

### Python Client Example

```python
import requests
import json

# Store a chunk
chunk_data = {
    "filename": "document.txt",
    "chunk_number": 1,
    "chunk_content": "This is the content of the first chunk",
    "chunk_hash": "root_hash_from_0g_storage"
}

response = requests.post('http://127.0.0.1:8080/process_chunks', json=chunk_data)
print(response.json())

# Search for similar chunks
search_data = {
    "query": "What is the content of the first chunk?",
    "top_k": 3
}

response = requests.post('http://127.0.0.1:8080/search', json=search_data)
print(response.json())
```

### cURL Examples

```bash
# Store a chunk
curl -X POST http://127.0.0.1:8080/process_chunks \
  -H "Content-Type: application/json" \
  -d '{"filename":"doc.txt","chunk_number":1,"chunk_content":"Hello world","chunk_hash":"root_hash_from_0g_storage"}'

# Search
curl -X POST http://127.0.0.1:8080/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Hello world","top_k":3}'

# Get stats
curl http://127.0.0.1:8080/stats
```

## Performance Considerations

- **Embedding Model**: The `all-MiniLM-L6-v2` model provides a good balance between performance and accuracy
- **FAISS Index**: Uses inner product (cosine similarity) for fast approximate nearest neighbor search
- **Persistence**: Index is saved to disk after each update to prevent data loss
- **Memory Usage**: The FAISS index is loaded into memory for fast queries

## Error Handling

The service returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing required fields)
- `404`: Not Found (chunk doesn't exist)
- `500`: Internal Server Error

## Customization

### Changing the Embedding Model

To use a different model, modify the model initialization in the code:

```python
model = SentenceTransformer('your-desired-model')
```

Update `EMBEDDING_DIM` to match the model's embedding dimension.

### Changing Server Port

Modify the port in the `app.run()` call:

```python
app.run(host='127.0.0.1', port=your_port, debug=True)
```

## License

MIT
