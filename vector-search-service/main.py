from flask import Flask, request, jsonify
import numpy as np
from sentence_transformers import SentenceTransformer
import sqlite3
import json
import faiss
from typing import List, Dict
from datetime import datetime
import os

app = Flask(__name__)

# Initialize the embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Constants
EMBEDDING_DIM = 384  # Dimension for all-MiniLM-L6-v2
INDEX_FILE = 'faiss_index.bin'
DB_FILE = 'embeddings.db'

# Global variables for FAISS index and mapping
faiss_index = None
hash_to_id = {}  # Maps chunk_hash to FAISS index ID
id_to_hash = {}  # Maps FAISS index ID to chunk_hash
next_id = 0

def init_vector_index():
    """Initialize or load FAISS index."""
    global faiss_index, hash_to_id, id_to_hash, next_id
    
    if os.path.exists(INDEX_FILE):
        # Load existing index
        faiss_index = faiss.read_index(INDEX_FILE)
        # Load hash mappings
        if os.path.exists('hash_mapping.json'):
            with open('hash_mapping.json', 'r') as f:
                data = json.load(f)
                hash_to_id = data.get('hash_to_id', {})
                id_to_hash = {int(k): v for k, v in data.get('id_to_hash', {}).items()}
                next_id = max(id_to_hash.keys()) + 1 if id_to_hash else 0
    else:
        # Create new index
        base_index = faiss.IndexFlatIP(EMBEDDING_DIM)  # Inner Product for cosine similarity
        faiss_index = faiss.IndexIDMap(base_index)
        hash_to_id = {}
        id_to_hash = {}
        next_id = 0

def init_sqlite_db():
    """Initialize SQLite database for metadata."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS chunks
                 (chunk_hash TEXT PRIMARY KEY,
                  faiss_id INTEGER UNIQUE,
                  filename TEXT, 
                  chunk_number INTEGER,
                  created_at TIMESTAMP)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_filename ON chunks(filename)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_faiss_id ON chunks(faiss_id)')
    conn.commit()
    conn.close()

def save_index():
    """Save FAISS index and hash mappings to disk."""
    faiss.write_index(faiss_index, INDEX_FILE)
    with open('hash_mapping.json', 'w') as f:
        json.dump({
            'hash_to_id': hash_to_id,
            'id_to_hash': {str(k): v for k, v in id_to_hash.items()}  # Convert int keys to str for JSON
        }, f)

def compute_embedding(text: str) -> np.ndarray:
    """Compute and normalize embedding for a given text."""
    embedding = model.encode(text)
    # Normalize for cosine similarity
    embedding = embedding / np.linalg.norm(embedding)
    return embedding.astype(np.float32)

def store_embedding(filename: str, chunk_number: int, chunk_hash: str, 
                  embedding: np.ndarray):
    """Store the chunk data and embedding in both FAISS and SQLite."""
    global faiss_index, hash_to_id, id_to_hash, next_id
    
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:

        # Add new record
        faiss_id = next_id
        next_id += 1
        
        # Add to FAISS
        faiss_index.add_with_ids(embedding.reshape(1, -1), np.array([faiss_id], dtype=np.int64))
        
        # Add to SQLite
        c.execute('''INSERT INTO chunks 
                        (chunk_hash, faiss_id, filename, chunk_number, created_at)
                        VALUES (?, ?, ?, ?, ?)''',
                    (chunk_hash, faiss_id, filename, chunk_number, datetime.now()))
        
        # Update mappings
        hash_to_id[chunk_hash] = faiss_id
        id_to_hash[faiss_id] = chunk_hash
        
        conn.commit()
        
        # Save index after each update
        save_index()
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def search_embeddings(query_embedding: np.ndarray, top_k: int = 5) -> List[Dict]:
    """Search for similar chunks using FAISS."""
    if faiss_index.ntotal == 0:
        return []
    
    # FAISS expects 2D array
    query_embedding = query_embedding.reshape(1, -1)
    
    # Search
    distances, indices = faiss_index.search(query_embedding, min(top_k, faiss_index.ntotal))
    
    results = []
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    for distance, idx in zip(distances[0], indices[0]):
        if idx == -1:  # FAISS returns -1 for invalid indices
            continue
        
        chunk_hash = id_to_hash.get(int(idx))
        if not chunk_hash:
            continue
            
        # Get metadata from SQLite using chunk_hash
        c.execute('SELECT filename, chunk_number FROM chunks WHERE chunk_hash = ?', (chunk_hash,))
        row = c.fetchone()
        
        if row:
            filename, chunk_number = row
            results.append({
                'filename': filename,
                'chunk_number': chunk_number,
                'chunk_hash': chunk_hash,
                'similarity_score': float(distance)  # For normalized vectors, this is cosine similarity
            })
    
    conn.close()
    return results

@app.route('/process_chunks', methods=['POST'])
def process_chunks():
    """Endpoint to process and store text chunks with embeddings."""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['filename', 'chunk_number', 'chunk_content', 'chunk_hash']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        print("I am here")
        # Compute embedding
        embedding = compute_embedding(data['chunk_content'])
        
        print("I am there")
        # Store in both FAISS and SQLite
        store_embedding(
            data['filename'],
            data['chunk_number'],
            data['chunk_hash'],
            embedding
        )
        print("I am after there")

        return jsonify({
            'status': 'success',
            'message': f"Stored chunk {data['chunk_number']} from {data['filename']}",
            'chunk_hash': data['chunk_hash'],
            'total_chunks': faiss_index.ntotal
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/search', methods=['POST'])
def search():
    """Endpoint to search for similar chunks based on a query."""
    try:
        data = request.get_json()
        
        if 'query' not in data:
            return jsonify({'error': 'Missing query field'}), 400
        
        # Get top_k parameter (default: 5)
        top_k = data.get('top_k', 5)
        
        # Compute query embedding
        query_embedding = compute_embedding(data['query'])
        
        # Search for similar chunks
        results = search_embeddings(query_embedding, top_k)
        
        return jsonify({
            'query': data['query'],
            'total_results': len(results),
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/search/filter', methods=['POST'])
def search_with_filter():
    """Search with additional filters (e.g., by filename)."""
    try:
        data = request.get_json()
        
        if 'query' not in data:
            return jsonify({'error': 'Missing query field'}), 400
        
        top_k = data.get('top_k', 5)
        filename_filter = data.get('filename')  # Optional filter
        
        # Compute query embedding
        query_embedding = compute_embedding(data['query'])
        
        # Get more results to filter
        all_results = search_embeddings(query_embedding, top_k * 3)
        
        # Apply filter
        if filename_filter:
            all_results = [r for r in all_results if r['filename'] == filename_filter]
        
        # Return top k after filtering
        results = all_results[:top_k]
        
        return jsonify({
            'query': data['query'],
            'filter': filename_filter,
            'total_results': len(results),
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_chunk/<chunk_hash>', methods=['GET'])
def get_chunk_by_hash(chunk_hash):
    """Retrieve a specific chunk by its hash."""
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute('SELECT filename, chunk_number, created_at FROM chunks WHERE chunk_hash = ?', 
                 (chunk_hash,))
        row = c.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'error': 'Chunk not found'}), 404
        
        return jsonify({
            'chunk_hash': chunk_hash,
            'filename': row[0],
            'chunk_number': row[1],
            'created_at': row[2]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/delete/<chunk_hash>', methods=['DELETE'])
def delete_chunk(chunk_hash):
    """Delete a chunk by its hash."""
    global faiss_index, hash_to_id, id_to_hash
    
    try:
        # Get faiss_id from hash mapping
        faiss_id = hash_to_id.get(chunk_hash)
        
        if faiss_id is None:
            return jsonify({'error': 'Chunk not found'}), 404
        
        # Remove from FAISS
        faiss_index.remove_ids(np.array([faiss_id], dtype=np.int64))
        
        # Remove from SQLite
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute('DELETE FROM chunks WHERE chunk_hash = ?', (chunk_hash,))
        conn.commit()
        conn.close()
        
        # Remove from mappings
        del hash_to_id[chunk_hash]
        del id_to_hash[faiss_id]
        
        # Save changes
        save_index()
        
        return jsonify({
            'status': 'success',
            'message': f"Deleted chunk with hash {chunk_hash}"
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def stats():
    """Get statistics about the index."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    # Get unique file count
    c.execute('SELECT COUNT(DISTINCT filename) FROM chunks')
    unique_files = c.fetchone()[0]
    
    conn.close()
    
    return jsonify({
        'total_chunks': faiss_index.ntotal,
        'embedding_dimension': EMBEDDING_DIM,
        'unique_files': unique_files,
        'hash_to_id_size': len(hash_to_id)
    }), 200

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'total_chunks': faiss_index.ntotal
    }), 200

# Initialize on startup
init_vector_index()
init_sqlite_db()

if __name__ == '__main__':
    print("Starting vector search service on http://127.0.0.1:8080")
    print(f"FAISS index loaded with {faiss_index.ntotal} vectors")
    print("Endpoints:")
    print("  POST /process_chunks - Store chunk with embedding")
    print("  POST /search - Search for similar chunks")
    print("  POST /search/filter - Search with filename filter")
    print("  GET /get_chunk/<chunk_hash> - Get chunk by hash")
    print("  DELETE /delete/<chunk_hash> - Delete chunk by hash")
    print("  GET /stats - Get index statistics")
    print("  GET /health - Health check")
    app.run(host='127.0.0.1', port=8080, debug=True)