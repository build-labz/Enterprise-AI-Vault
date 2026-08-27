import express from 'express';
import multer from 'multer';
import path from 'path';
import OpenAI from "openai";

import { splitTextAtSentencesAdvanced } from './text-utils.js';

import { uploadFile, uploadString, downloadFromIndexerToBlob, saveRootHashInSmartContract } from './0g-utils.js';

const app = express();
const PORT = 3000;

const __dirname = path.resolve();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

const client = new OpenAI({
    baseURL: "https://router-api.0g.ai/v1",
    apiKey: process.env.API_KEY,
    defaultHeaders: {
        "X-0G-Provider-Trust-Mode": "private",
    },
});

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (optional - if you have CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint 1: Serve the predefined HTML file
app.get('/', (req, res) => {
    // Serve the HTML file from your filesystem
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Endpoint 2: Upload a text file (max 10MB)
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                message: 'Please upload a file with field name "file"'
            });
        }

        // Check if it's a text file
        const fileType = req.file.mimetype;
        if (!fileType.startsWith('text/') && !fileType.includes('plain')) {
            return res.status(400).json({
                error: 'Invalid file type',
                message: 'Only text files are allowed'
            });
        }

        // Convert buffer to string
        const fileContent = req.file.buffer.toString('utf-8');

        //split the file
        const chunks = splitTextAtSentencesAdvanced(fileContent);

        //store each chunk in storage
        var allChunksData = [];
        var i = 0;
        for (i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const rootHash = await uploadString(chunk);
            const chunkData = {
                filename: req.file.originalname,
                chunk_number: i,
                chunk_content: chunk,
                chunk_hash: rootHash
            };
            console.log(`Chunk ${i} uploaded with root hash: ${rootHash}`);
            allChunksData.push({
                filename: req.file.originalname,
                chunk_number: i,
                chunk_hash: rootHash
            });

            // send chunk to python code
            const response = await fetch('http://127.0.0.1:8080/process_chunks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chunkData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();


        }


        // store the index in storage
        const chunkIndexData = JSON.stringify(allChunksData);
        console.log("chunkIndexData", chunkIndexData);
        const rootHashOfChunkIndex = await uploadString(chunkIndexData);
        console.log("allChunksData", allChunksData);

        console.log(`All chunks uploaded. Root hash of chunk index: ${rootHashOfChunkIndex}`);

        // store the index address in smart contract
        await saveRootHashInSmartContract(rootHashOfChunkIndex);


        res.json({
            message: 'File uploaded successfully',
            filename: req.file.originalname,
            size: req.file.size,
            total_chunks: chunks.length,
            root_hash_of_chunk_index: rootHashOfChunkIndex,
            all_chunks_data: allChunksData
        });

    } catch (error) {
        res.status(500).json({
            error: 'Upload failed',
            message: error.message
        });
    }
});

// Error handler for multer (file too large, etc.)
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'FILE_TOO_LARGE') {
            return res.status(413).json({
                error: 'File too large',
                message: 'Maximum file size is 10MB'
            });
        }
    }
    next(error);
});

// Endpoint 3: Chat endpoint - receives {text:string} and returns it
app.post('/chat', async(req, res) => {
    try {
        const { text } = req.body;

        // Validate that text field exists
        if (text === undefined || text === null) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Request body must contain a "text" field'
            });
        }

        // Validate that text is a string
        if (typeof text !== 'string') {
            return res.status(400).json({
                error: 'Invalid request',
                message: '"text" field must be a string'
            });
        }


        const response = await fetch('http://127.0.0.1:8080/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: text,
                top_k: 1
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        var foundChunkData = "";

        const responseData = await response.json();
        console.log("responseData: ", responseData);
        var i;
        for (i=0; i<responseData.results.length; i++) {
            const chunkData = responseData.results[i];

            const rootHash = chunkData.chunk_hash;
            const blob = await downloadFromIndexerToBlob(rootHash);
            const item = await blob.text();
            foundChunkData += item + ` (Reference: ${chunkData.filename}#${chunkData.chunk_number})\n`;
            console.log("item: ", item);
        }

        console.log("info: ", { role: "user", content: foundChunkData + "\n\n" + text });

        const llmResponse = await client.chat.completions.create({
            model: "0gm-1.0-35b-a3b",
            messages: [
                { 
                    role: "system", 
                    content: "Answer using ONLY the provided context with the corresponding reference. Be brief (max 3 sentences). If unknown, say 'I don't know. Please also mention the reference in parenthesis.'" 
                },
                { 
                    role: "user", 
                    content: "Context: " + foundChunkData + "\n\nQuestion: " + text 
                }
            ],
            stream: false,
            chat_template_kwargs: { enable_thinking: false },
        });

        const responseText = llmResponse.choices[0]?.message?.content;


        // Return the text field
        res.json({
            received: text,
            response: responseText,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            error: 'Chat endpoint failed',
            message: error.message
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📤 Upload endpoint: http://localhost:${PORT}/upload`);
    console.log(`💬 Chat endpoint: http://localhost:${PORT}/chat`);
});
