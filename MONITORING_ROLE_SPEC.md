# 📊 Spesifikasi Role Monitoring

## 1. Ringkasan

**Role Monitoring** adalah role khusus yang hanya dapat melihat statistik platform secara agregat (angka saja). Role ini tidak memiliki akses ke fitur WhatsApp atau data detail user.

---

## 2. Hak Akses

| Aspek | Keterangan |
|-------|------------|
| Siapa yang bisa assign | Hanya **Admin** |
| Akses data | Statistik agregat platform-wide (angka saja) |
| Modifikasi | ❌ Tidak bisa edit/create/delete apapun |
| Fitur WhatsApp | ❌ Disabled semua |

---

## 3. Perubahan Database

### User Model - Tambah Role Baru
```prisma
enum Role {
  user
  admin
  monitoring  // NEW
}
```

---

## 4. Halaman & Fitur

### 4.1 📈 Monitoring Dashboard

| Metrik | Deskripsi | Query |
|--------|-----------|-------|
| Total Pesan Masuk | Semua pesan incoming dari semua device | `Message.count(type: 'incoming')` |
| Total Pesan Terkirim | Semua pesan outgoing berhasil | `Message.count(type: 'outgoing', status: 'sent/delivered/read')` |
| Total Pesan Gagal | Pesan outgoing yang failed | `Message.count(type: 'outgoing', status: 'failed')` |
| Total User Terdaftar | Semua user di platform | `User.count()` |
| API Traffic Masuk | Request masuk via API Key | *Perlu tracking* |
| API Traffic Keluar | Request keluar via API Key | *Perlu tracking* |
| Pendapatan Bulanan | Total revenue bulan ini | *Dari tabel Payment* |

**Filter Pendapatan:**
- Range tanggal (awal bulan - akhir bulan)
- Default: bulan berjalan

---

### 4.2 👥 User Stats

| Metrik | Deskripsi |
|--------|-----------|
| Total User | Semua user terdaftar |
| Plan Free | User dengan plan 'free' |
| Plan Pro | User dengan plan 'pro' |
| Plan Enterprise | User dengan plan 'enterprise' |
| Plan Unlimited | User dengan plan 'unlimited' |

**Visualisasi:** Pie chart / Bar chart distribusi plan

---

### 4.3 📱 Connection Stats

| Metrik | Deskripsi |
|--------|-----------|
| Total Device | Semua device di platform |
| Connected | Status 'connected' |
| Disconnected | Status 'disconnected' |
| Connecting | Status 'connecting' / 'qr' |

**Visualisasi:** Donut chart status device

---

### 4.4 🔗 Integration Stats

| Metrik | Deskripsi |
|--------|-----------|
| Per kategori | Count integration by type (Telegram, Discord, Slack, dll) |

**Visualisasi:** Bar chart per integration type

---

### 4.5 🤖 Chatbot Monitor

| Metrik | Deskripsi |
|--------|-----------|
| Total Chatbot | Semua chatbot yang dibuat |
| Chatbot Aktif | Chatbot dengan status 'active' |
| Session Aktif | Percakapan chatbot yang sedang berlangsung |

**Catatan:** Perlu tracking chatbot sessions yang aktif

---

### 4.6 📢 Broadcast Stats

| Metrik | Deskripsi |
|--------|-----------|
| Total Broadcast | Semua broadcast campaign |
| Pending | Status 'pending' |
| Running | Status 'running' |
| Completed | Status 'completed' |
| Failed | Status 'failed' |

---

### 4.7 📇 Contact Stats

| Metrik | Deskripsi |
|--------|-----------|
| Total Contact | Semua kontak di platform |
| Total Email | Kontak yang punya email |
| Download Contact | Export CSV semua kontak (tanpa data sensitif) |
| Download Email | Export CSV email saja |

**Format Export:**
- Contact: name, phone (masked), created_at
- Email: email only

---

### 4.8 🔔 Webhook Stats

| Metrik | Deskripsi |
|--------|-----------|
| Total Webhook | Semua webhook terdaftar |
| Active | Webhook dengan isActive = true |
| Inactive | Webhook dengan isActive = false |

---

## 5. UI/UX Design

### Sidebar Monitoring (Dedicated)
```
📊 Dashboard
👥 Users  
📱 Connections
🔗 Integrations
🤖 Chatbots
📢 Broadcasts
📇 Contacts
🔔 Webhooks
---
⚙️ Profile Settings
🚪 Logout
```

### Layout
- Grid-based dashboard
- Card components untuk setiap metrik
- Real-time update via Socket.IO (optional)
- Auto-refresh setiap 30 detik
- Dark theme konsisten dengan app

---

## 6. Backend API Endpoints

### Baru
```
GET /api/monitoring/dashboard     - Stats utama
GET /api/monitoring/users         - User breakdown by plan
GET /api/monitoring/connections   - Device stats
GET /api/monitoring/integrations  - Integration breakdown
GET /api/monitoring/chatbots      - Chatbot stats + active sessions
GET /api/monitoring/broadcasts    - Broadcast stats
GET /api/monitoring/contacts      - Contact + email counts
GET /api/monitoring/contacts/export?type=contact|email
GET /api/monitoring/webhooks      - Webhook stats
```

### Middleware
- `monitoringOnly` - Hanya role 'monitoring' atau 'admin' yang bisa akses

---

## 7. Tracking Baru yang Diperlukan

### API Traffic Tracking
Untuk mencatat traffic masuk/keluar via API Key, perlu:
1. Middleware untuk log setiap request dengan API Key
2. Tabel baru atau field di ApiKey untuk track usage

```prisma
model ApiKeyUsage {
  id        String   @id @default(cuid())
  apiKeyId  String
  endpoint  String
  method    String
  timestamp DateTime @default(now())
  apiKey    ApiKey   @relation(fields: [apiKeyId], references: [id])
}
```

### Chatbot Session Tracking
Untuk mengetahui percakapan chatbot yang aktif:
1. Track session start/end
2. Session dianggap aktif jika ada activity dalam 30 menit terakhir

---

## 8. Implementasi Fase

### Fase 1: Core (Wajib)
- [ ] Role 'monitoring' di database
- [ ] Sidebar khusus monitoring
- [ ] Dashboard dengan stats dasar
- [ ] User Stats
- [ ] Connection Stats
- [ ] Broadcast Stats
- [ ] Webhook Stats

### Fase 2: Extended
- [ ] Contact Stats + Export
- [ ] Integration Stats
- [ ] Chatbot Stats (tanpa active session tracking)

### Fase 3: Advanced
- [ ] API Traffic Tracking
- [ ] Chatbot Active Session Tracking
- [ ] Pendapatan (setelah payment aktif)
- [ ] Real-time updates via Socket.IO

---

## 9. Keputusan Final

| Pertanyaan | Jawaban |
|------------|---------|
| API Traffic | ✅ Counter saja (tidak perlu detail log) |
| Export Contact | ✅ Raw data langsung tanpa masking |
| Real-time | ✅ **Auto-refresh setiap 30 detik** + tombol manual refresh |
| Access Log | ❌ Tidak diperlukan |

**Rekomendasi Real-time:**
- Auto-refresh setiap 30 detik untuk balance antara freshness dan performance
- Ada tombol manual refresh jika ingin data terbaru segera
- Indikator "Last updated: X seconds ago"

---

## 10. Timeline Estimasi

| Fase | Durasi Estimasi |
|------|-----------------|
| Fase 1 | 2-3 jam |
| Fase 2 | 1-2 jam |
| Fase 3 | 2-3 jam |

**Total:** ~5-8 jam kerja

---
Email: monitoring@kewhats.app
Password: monitoring123

*Dokumen ini akan diupdate berdasarkan diskusi.*
