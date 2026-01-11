# 🚀 KeWhats - Ultimate WhatsApp Gateway & Business Automation Platform

![KeWhats Hero Banner](https://raw.githubusercontent.com/username/repo/main/public/banner.png)

KeWhats adalah platform **All-in-One WhatsApp Gateway** yang dirancang untuk mentransformasi cara bisnis berkomunikasi. Bukan sekadar pengirim pesan, KeWhats adalah ekosistem lengkap yang menggabungkan fitur Customer Service (Inbox), Marketing (Broadcast), Automation (Chatbot & Integrations), dan Intelligence (AI) dalam satu dashboard yang elegan dan responsif.

---

## 🏗️ Technical Architecture

### Core Engine
- **Engine:** [Baileys](https://github.com/WhiskeySockets/Baileys) - Library WhatsApp paling stabil dan low-resource.
- **Real-time Synchronization:** Socket.io untuk transmisi data QR Code dan pesan masuk secara instan.
- **Automation Logic:** Custom flow execution engine untuk menangani chatbot tanpa lag.
- **AI Brain:** Terintegrasi langsung dengan Google Gemini 2.0 Flash untuk pemrosesan bahasa alami (NLP).

### Frontend Architecture
- **State Flow:** React 19 dengan Context API untuk manajemen state global (Auth, Device Status).
- **Data Fetching:** TanStack Query v5 untuk caching data dan optimis updates.
- **UI System:** Modern Glassmorphism Design dengan Vanilla CSS (zero external CSS library overhead).

---

## 🔥 Fitur Komprehensif (Detailed)

### 1. 📱 Dashboard & Device Management
- **Centralized Dashboard:** Pantau statistik device, pesan, dan kuota dalam satu layar.
- **Multi-Device Support:** Hubungkan banyak nomor WhatsApp sekaligus.
- **Connection Monitor:** Status koneksi realtime (Connected, Disconnected, Connecting).
- **QR Engine:** Sistem scan QR otomatis dengan sesi yang persisten.

### 2. 📨 Customer Engagement (Inbox & Live Chat)
- **Omni-Inbox:** Semua percakapan dari semua device masuk ke satu inbox terpusat.
- **Interactive Messaging:** Kirim teks, gambar, video, dokumen, audio, hingga kontak.
- **Quick Replies:** Template jawaban instan untuk pertanyaan berulang (FAQ).
- **Message Status:** Tracking status pesan secara detail (Pending, Sent, Delivered, Read).
- **Conversation Management:** Archive, mark as read, atau hapus percakapan.

### 3. 🤖 Marketing & Automation
- **Advanced Broadcaster:** Kirim pesan massal dengan penjadwalan (Now, Scheduled, Recurring).
- **Timezone Aware:** Kirim pesan sesuai waktu lokal penerima.
- **Visual Chatbot Builder:** Rancang alur bot dengan sistem drag-and-drop (React Flow).
- **Auto-Reply Rules:** Sistem keyword matching cerdas (Exact, Contains, Regex).
- **Delay Control:** Atur jeda antar pesan agar terlihat lebih manusiawi.

### 4. 👥 Contact & Group Management
- **Contact Segmentation:** Kelompokkan kontak dengan sistem Tagging.
- **Bulk Import/Export:** Kelola ribuan kontak via CSV/Excel.
- **Group Interaction:** Ambil data grup, list member, dan kirim pesan otomatis ke grup.
- **Member Sync:** Sinkronisasi member grup untuk database marketing.

### 5. 🔌 Ecosystem & Integrations
- **Webhook System:** Terima callback otomatis saat ada pesan atau status berubah.
- **Integration Marketplace:** Hubungkan ke Google Sheets (2-way sync), Telegram, Discord, Slack, Notion, dan Airtable.
- **n8n Native Integration:** Disediakan folder setup dan tutorial khusus untuk user n8n.
- **RESTful API:** Dokumentasi API lengkap dengan API Key untuk integrasi ke sistem eksternal.

### 6. 🧠 Intelligence (AI Smart Features)
- **Intent Detection:** AI membantu mendeteksi maksud dari pesan customer.
- **Sentiment Indicator:** Visualisasi emosi customer di tiap chat.
- **Smart Compose:** AI membantu membuatkan balasan atau materi promosi.
- **Smart Insights:** Laporan kecerdasan bisnis berdasarkan riwayat percakapan.

### 7. 🧠 Smart Knowledge (RAG-Powered Knowledge Base)
- **Knowledge Base Management:** Upload dokumen FAQ, produk, atau informasi bisnis Anda.
- **Automatic Chunking & Embedding:** Sistem otomatis memecah dan memproses dokumen untuk pencarian semantik.
- **RAG (Retrieval-Augmented Generation):** AI menjawab pertanyaan berdasarkan knowledge base Anda.
- **Chatbot Integration:** Tambahkan "Smart Knowledge Node" ke chatbot untuk respons cerdas.
- **Auto Reply Fallback:** Aktifkan RAG sebagai fallback ketika tidak ada rule auto-reply yang cocok.
- **Inbox SmartReply:** Toggle Knowledge mode untuk mendapatkan saran balasan berbasis knowledge base.
- **BYOK (Bring Your Own Key):** Gunakan OpenAI API key sendiri untuk embedding unlimited.

### 8. 👥 Team & Security
- **Multi-Agent Access:** Undang tim kamu ke dalam dashboard.
- **Role Hierarchy:** Owner (full access), Admin (management), Member (chat only).
- **Audit Logs:** Log keamanan yang mencatat setiap aktivitas sensitive di sistem.
- **Rate Limiter:** Proteksi sistem dari penyalahgunaan API dan spam.

### 9. 💸 Billing & Subscription
- **Payment Automated:** Bayar langganan via Midtrans atau Xendit (QRIS, VA, E-Wallet).
- **Usage Tracker:** Pantau sisa kuota pesan dan masa aktif plan secara visual.
- **Invoice Center:** Download invoice PDF otomatis setelah pembayaran.

---

## 🏛️ Project Directory Structure

```text
wa/
├── server/                     # Backend API & WhatsApp Engine
│   ├── prisma/                 # SQLite/PostgreSQL Models
│   ├── src/
│   │   ├── services/           # Logika Inti (AI, Billing, WA, DB)
│   │   ├── routes/             # API Endpoints (Integrations, Teams, etc)
│   │   ├── middleware/         # Auth, RateLimit, ErrorHandler
│   │   └── integrations/       # Handlers untuk GSheets, Discord, dll
├── src/                        # Frontend React Application
│   ├── pages/                  # Chatbot, Analytics, N8nSetup, dll
│   ├── components/             # Sidebar, Navbar, Modals, Cards
│   ├── context/                # Global State (Auth, Socket)
│   └── styles/                 # Global & Component CSS
```

---

## � Memulai (Installation)

1.  **Backend:**
    ```bash
    cd server
    npm install
    npx prisma db push
    npm run dev
    ```
2.  **Frontend:**
    ```bash
    cd ..
    npm install
    npm run dev
    ```

---

## �️ Standar Keamanan
KeWhats menggunakan teknik **Random Delay** dan **Queue Priority** untuk meniru perilaku manusia saat mengirim pesan, sehingga meminimalisir kemungkinan nomor diblokir oleh pihak WhatsApp.

---

## 🤝 Kontribusi
Project ini masih terus berkembang! Kami sangat menghargai kontribusi dalam bentuk Pull Request atau pelaporan Bug.

---

**Made with Precision for High-Growth Businesses.**  
© 2026 KeWhats Team.
