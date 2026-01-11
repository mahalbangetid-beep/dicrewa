# 🧠 Smart Knowledge (RAG) - Implementation Plan

## Overview
Fitur **Smart Knowledge** memungkinkan user membuat knowledge base berbasis teks yang akan digunakan AI untuk menjawab pertanyaan customer secara otomatis menggunakan teknik RAG (Retrieval-Augmented Generation).

---

## 📋 Spesifikasi

### Naming & Branding
- **Nama Fitur**: Smart Knowledge
- **Lokasi Sidebar**: Di bawah "Chatbot"
- **Icon**: `Brain` atau `BookOpen` dari lucide-react

### Query Limits per Plan
| Plan | RAG Queries/Bulan |
|------|-------------------|
| Free | 50 |
| Pro | 1,000 |
| Enterprise | 5,000 |
| Unlimited | Unlimited |

### Tech Stack
- **Embedding Model**: OpenAI `text-embedding-3-small`
- **Vector Storage**: SQLite + JSON (embedding disimpan sebagai JSON array)
- **Chunking**: Hybrid (paragraph + fixed size fallback)
- **BYOK**: Ya, hidden untuk plan Unlimited

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│  Smart Knowledge Page                                            │
│  ├── Knowledge Base List (CRUD)                                  │
│  ├── Knowledge Editor (Textarea + Settings)                      │
│  ├── Test Query Panel                                            │
│  └── Usage Stats (queries used/limit)                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND API                              │
├─────────────────────────────────────────────────────────────────┤
│  POST   /api/knowledge              - Create knowledge base      │
│  GET    /api/knowledge              - List user's knowledge      │
│  GET    /api/knowledge/:id          - Get knowledge details      │
│  PUT    /api/knowledge/:id          - Update knowledge           │
│  DELETE /api/knowledge/:id          - Delete knowledge           │
│  POST   /api/knowledge/:id/process  - Process & create embeddings│
│  POST   /api/knowledge/query        - Query RAG                  │
│  GET    /api/knowledge/usage        - Get query usage stats      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RAG SERVICE                                 │
├─────────────────────────────────────────────────────────────────┤
│  KnowledgeService                                                │
│  ├── createKnowledge(name, content, deviceIds)                   │
│  ├── processKnowledge(id) - chunk & embed                        │
│  ├── queryKnowledge(query, knowledgeIds) - RAG query             │
│  ├── getRelevantChunks(query, topK) - similarity search          │
│  └── generateAnswer(query, context) - LLM generation             │
│                                                                  │
│  EmbeddingService                                                │
│  ├── createEmbedding(text) - call OpenAI                         │
│  ├── batchEmbeddings(texts) - batch processing                   │
│  └── cosineSimilarity(a, b) - calculate similarity               │
│                                                                  │
│  ChunkingService                                                 │
│  ├── chunkText(text, strategy) - split text                      │
│  ├── chunkByParagraph(text) - split by \n\n                      │
│  └── chunkBySize(text, maxSize) - split by char count            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      INTEGRATIONS                                │
├─────────────────────────────────────────────────────────────────┤
│  1. Chatbot Builder: "Smart Knowledge Node"                      │
│     - Select knowledge base                                      │
│     - Min confidence threshold                                   │
│     - Fallback message                                           │
│                                                                  │
│  2. Auto Reply: RAG Fallback                                     │
│     - Jika tidak ada keyword match, query ke RAG                 │
│     - Settings: enable/disable, select knowledge base            │
│                                                                  │
│  3. Inbox SmartReply: Knowledge Context                          │
│     - Augment SmartReply suggestions dengan knowledge            │
│     - Tampilkan "from knowledge base" indicator                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### Tambahan di schema.prisma:

```prisma
// Smart Knowledge - Knowledge Base
model KnowledgeBase {
  id          String   @id @default(cuid())
  name        String
  description String?
  content     String   // Raw text content
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceIds   String?  // JSON array of device IDs that can use this
  status      String   @default("pending") // pending, processing, ready, error
  chunkCount  Int      @default(0)
  isActive    Boolean  @default(true)
  errorMessage String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  chunks      KnowledgeChunk[]
}

// Knowledge Chunks with Embeddings
model KnowledgeChunk {
  id              String        @id @default(cuid())
  knowledgeBaseId String
  knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id], onDelete: Cascade)
  content         String        // Chunk text
  embedding       String        // JSON array of floats (1536 dimensions for small model)
  tokenCount      Int
  chunkIndex      Int           // Order in the document
  createdAt       DateTime      @default(now())
}

// RAG Query Usage Tracking
model KnowledgeUsage {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  month     String   // Format: "2024-01" for monthly tracking
  queryCount Int     @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([userId, month])
}

// Update User model - tambahkan relation
model User {
  // ... existing fields ...
  knowledgeBases  KnowledgeBase[]
  knowledgeUsage  KnowledgeUsage[]
}
```

---

## 🎨 UI/UX Design

### 1. Smart Knowledge Page (Main)

```
┌──────────────────────────────────────────────────────────────────┐
│  🧠 Smart Knowledge                                              │
│  Train AI dengan knowledge base untuk menjawab customer otomatis │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────┐  ┌───────────────────┐  │
│  │ 📊 Query Usage                      │  │ [+ Buat Knowledge]│  │
│  │ ▓▓▓▓▓▓▓░░░░░░░░░░░░░ 156/1000      │  └───────────────────┘  │
│  │ Reset: 25 hari lagi                 │                         │
│  └─────────────────────────────────────┘                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📖 FAQ Produk                                              │  │
│  │ 12 chunks • Assigned to: Device 1, Device 2               │  │
│  │ ✅ Ready                                    [Test] [Edit]  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📖 Info Pengiriman                                         │  │
│  │ 8 chunks • Assigned to: All Devices                       │  │
│  │ ✅ Ready                                    [Test] [Edit]  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📖 Kebijakan Garansi                                       │  │
│  │ 🔄 Processing embeddings...                                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2. Create/Edit Knowledge Modal

```
┌──────────────────────────────────────────────────────────────────┐
│  📖 Buat Knowledge Base                                     [X]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Nama Knowledge:                                                 │
│  [FAQ Produk                                                  ]  │
│                                                                  │
│  Deskripsi (opsional):                                           │
│  [Berisi FAQ seputar produk dan layanan                       ]  │
│                                                                  │
│  Konten Knowledge:                                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Q: Berapa harga paket basic?                               │  │
│  │ A: Paket basic seharga Rp 99.000/bulan dengan kuota 1000   │  │
│  │    pesan per bulan.                                        │  │
│  │                                                             │  │
│  │ Q: Bagaimana cara upgrade paket?                           │  │
│  │ A: Anda bisa upgrade paket melalui menu Billing >          │  │
│  │    Subscription > Upgrade Plan.                            │  │
│  │                                                             │  │
│  │ Q: Apakah ada free trial?                                  │  │
│  │ A: Ya, kami menyediakan 14 hari trial gratis untuk semua   │  │
│  │    fitur premium.                                          │  │
│  │                                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│  📝 Tips: Pisahkan setiap topik dengan baris kosong             │
│                                                                  │
│  Assign ke Device:                                               │
│  [✓] Semua Device                                                │
│  [ ] Device 1 (08123456789)                                      │
│  [ ] Device 2 (08987654321)                                      │
│                                                                  │
│  ────────────────────────────────────────────────────────────    │
│                                                                  │
│  [Batal]                                    [Simpan & Process]   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3. Test Query Panel

```
┌──────────────────────────────────────────────────────────────────┐
│  🧪 Test Smart Knowledge                                    [X]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Knowledge Base: [FAQ Produk                              ▼]    │
│                                                                  │
│  Pertanyaan:                                                     │
│  [berapa harga langganan bulanan?                      ] [Test]  │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  📊 Chunks yang Ditemukan (Top 3):                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1. "Paket basic seharga Rp 99.000/bulan dengan kuota..."  │  │
│  │    Similarity: 92%                                         │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 2. "Paket pro seharga Rp 299.000/bulan dengan kuota..."   │  │
│  │    Similarity: 87%                                         │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 3. "Anda bisa upgrade paket melalui menu Billing..."      │  │
│  │    Similarity: 72%                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  🤖 Jawaban AI:                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Harga langganan bulanan kami:                              │  │
│  │ - Paket Basic: Rp 99.000/bulan (kuota 1000 pesan)         │  │
│  │ - Paket Pro: Rp 299.000/bulan (kuota 5000 pesan)          │  │
│  │                                                             │  │
│  │ Tersedia juga free trial 14 hari untuk mencoba semua      │  │
│  │ fitur premium.                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4. Admin Settings (Embedding API Key)

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings > AI Configuration                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🧠 Smart Knowledge (RAG) Settings                               │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  Platform Embedding API Key (Admin Only):                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx                    ]  │  │
│  │ OpenAI API key untuk embedding platform                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ⚠️ Digunakan untuk user yang tidak set API key sendiri          │
│                                                                  │
│  Default Embedding Model:                                        │
│  [○ text-embedding-3-small  ● text-embedding-3-large]            │
│                                                                  │
│  RAG Query Limits:                                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Plan        │  Limit/Bulan  │  BYOK Option               │  │
│  ├──────────────┼───────────────┼────────────────────────────┤  │
│  │  Free        │  50           │  ✓ Show                    │  │
│  │  Pro         │  1,000        │  ✓ Show                    │  │
│  │  Enterprise  │  5,000        │  ✓ Show                    │  │
│  │  Unlimited   │  Unlimited    │  ✗ Hidden                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Save Settings]                                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 5. User BYOK Settings (Non-Unlimited Plans Only)

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings > AI Preferences                                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔑 Custom API Key (Opsional)                                    │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  Gunakan API key sendiri untuk query unlimited:                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxx                      ]  │  │
│  │ OpenAI API key dari platform.openai.com                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ℹ️ Jika diisi, query RAG tidak akan mengurangi kuota bulanan   │
│                                                                  │
│  [Save API Key]                                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📝 Implementation Steps

### Phase 1: Backend Foundation (Day 1)
- [x] **Step 1.1**: Update Prisma schema dengan model baru
- [x] **Step 1.2**: Run migration
- [x] **Step 1.3**: Create `knowledgeService.js` - CRUD operations
- [x] **Step 1.4**: Create `embeddingService.js` - OpenAI embedding calls
- [x] **Step 1.5**: Create `chunkingService.js` - text chunking logic
- [x] **Step 1.6**: Create `knowledge.js` routes

### Phase 2: RAG Logic (Day 2)
- [x] **Step 2.1**: Implement `processKnowledge()` - chunk & embed
- [x] **Step 2.2**: Implement `queryKnowledge()` - similarity search + generation
- [x] **Step 2.3**: Implement usage tracking & quota checking
- [x] **Step 2.4**: Add BYOK (own API key) support
- [ ] **Step 2.5**: Test API endpoints

### Phase 3: Frontend - Smart Knowledge Page (Day 3)
- [x] **Step 3.1**: Create `SmartKnowledge.jsx` page
- [x] **Step 3.2**: Add route & sidebar menu item
- [x] **Step 3.3**: Implement knowledge list view
- [x] **Step 3.4**: Implement create/edit modal
- [x] **Step 3.5**: Implement test query panel
- [x] **Step 3.6**: Add usage stats display
- [x] **Step 3.7**: Add CSS styling

### Phase 3.5: Admin Settings (Day 3)
- [x] **Step 3.5.1**: Add embedding API key setting to Settings page (Admin only)
- [x] **Step 3.5.2**: Add RAG settings route `/api/settings/ai-key` for admin
- [x] **Step 3.5.3**: Add BYOK input field for user settings (hidden for Unlimited plan)
- [x] **Step 3.5.4**: Store platform API key in server environment/config

### Phase 4: Chatbot Integration (Day 4)
- [x] **Step 4.1**: Add "Smart Knowledge Node" to Chatbot Builder
- [x] **Step 4.2**: Create node UI & settings panel
- [x] **Step 4.3**: Update chatbot execution logic to handle knowledge node
- [ ] **Step 4.4**: Test chatbot with knowledge node

### Phase 5: Auto Reply Integration (Day 5)
- [x] **Step 5.1**: Add RAG fallback option to Auto Reply settings
- [x] **Step 5.2**: Update `autoReplyService.js` to support RAG fallback
- [x] **Step 5.3**: Add knowledge base selection to Auto Reply
- [ ] **Step 5.4**: Test Auto Reply with RAG fallback

### Phase 6: Inbox Integration (Day 6)
- [x] **Step 6.1**: Augment SmartReply with knowledge context
- [x] **Step 6.2**: Add "from knowledge" indicator to suggestions
- [ ] **Step 6.3**: Test inbox with knowledge-augmented replies

### Phase 7: Testing & Polish (Day 7)
- [x] **Step 7.1**: End-to-end testing
- [x] **Step 7.2**: Error handling & edge cases
- [x] **Step 7.3**: Performance optimization (caching, batching)
- [x] **Step 7.4**: Update API documentation
- [x] **Step 7.5**: Final UI polish

---

## 🔧 Technical Details

### Chunking Strategy (Hybrid)
```javascript
function chunkText(text, options = {}) {
  const { maxChunkSize = 1000, overlapSize = 100 } = options;
  
  // Step 1: Split by paragraph first
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  
  // Step 2: If paragraph too long, split by fixed size
  const chunks = [];
  for (const para of paragraphs) {
    if (para.length <= maxChunkSize) {
      chunks.push(para.trim());
    } else {
      // Split long paragraph with overlap
      let start = 0;
      while (start < para.length) {
        const end = Math.min(start + maxChunkSize, para.length);
        chunks.push(para.slice(start, end).trim());
        start = end - overlapSize;
      }
    }
  }
  
  return chunks.filter(c => c.length > 20); // Filter tiny chunks
}
```

### Embedding & Similarity
```javascript
async function createEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536
  });
  return response.data[0].embedding;
}

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### RAG Query Flow
```javascript
async function queryKnowledge(query, knowledgeBaseIds, userId) {
  // 1. Check quota
  const usage = await checkQuota(userId);
  if (!usage.allowed) throw new Error('Query limit exceeded');
  
  // 2. Get query embedding
  const queryEmbedding = await createEmbedding(query);
  
  // 3. Get all relevant chunks
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { knowledgeBase: { id: { in: knowledgeBaseIds } } }
  });
  
  // 4. Calculate similarity & rank
  const scored = chunks.map(chunk => ({
    ...chunk,
    similarity: cosineSimilarity(queryEmbedding, JSON.parse(chunk.embedding))
  })).sort((a, b) => b.similarity - a.similarity);
  
  // 5. Take top 3 most relevant
  const topChunks = scored.slice(0, 3);
  
  // 6. Generate answer using LLM
  const context = topChunks.map(c => c.content).join('\n\n');
  const answer = await generateAnswer(query, context);
  
  // 7. Increment usage
  await incrementUsage(userId);
  
  return { answer, chunks: topChunks };
}
```

---

## ⚠️ Considerations

### Error Handling
- OpenAI API down → Show "AI temporarily unavailable"
- Embedding failed → Mark knowledge as "error" with message
- Empty results → Return "Tidak ditemukan informasi yang relevan"

### Performance
- Cache embeddings in memory for active knowledge bases
- Batch embedding requests (max 100 texts per request)
- Lazy load chunks only when querying

### Security
- Validate text content (no malicious input)
- Rate limit query API
- Sanitize LLM output

---

## 📁 File Structure

```
server/src/
├── routes/
│   └── knowledge.js         # API routes
├── services/
│   ├── knowledgeService.js  # Knowledge CRUD & RAG logic
│   ├── embeddingService.js  # OpenAI embedding calls
│   └── chunkingService.js   # Text chunking
└── middleware/
    └── ragQuota.js          # RAG query quota check

src/
├── pages/
│   └── SmartKnowledge.jsx   # Main page
├── components/
│   └── knowledge/
│       ├── KnowledgeList.jsx
│       ├── KnowledgeModal.jsx
│       ├── TestQueryPanel.jsx
│       └── UsageStats.jsx
└── index.css                # Add new styles
```

---

## ✅ Acceptance Criteria

1. User dapat membuat, edit, dan hapus knowledge base
2. System dapat memproses text menjadi chunks dan embeddings
3. User dapat test query knowledge base
4. RAG quota ditrack dan di-enforce per plan
5. Knowledge dapat di-assign ke specific devices
6. Chatbot Builder memiliki "Smart Knowledge" node
7. Auto Reply memiliki RAG fallback option
8. Inbox SmartReply augmented dengan knowledge context
9. BYOK tersedia untuk plan non-Unlimited (hidden untuk Unlimited)

---

## 🎯 Success Metrics

- Processing time < 30 detik untuk 10KB text
- Query response time < 3 detik
- Similarity accuracy > 80% untuk relevant queries
- Zero downtime during rollout

---

*Created: 2024-01-08*
*Status: Ready for Implementation*
