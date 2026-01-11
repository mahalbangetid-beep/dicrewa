# KeWhats VPS Deployment Guide

## File yang Dibutuhkan
- `kewhats-deploy.tar.gz` (sudah siap di folder project)

---

## LANGKAH DEPLOYMENT

### 1. Upload ke VPS
```bash
scp kewhats-deploy.tar.gz user@your-vps-ip:/home/user/
```

### 2. SSH ke VPS
```bash
ssh user@your-vps-ip
```

### 3. Extract File
```bash
cd /home/user
tar -xzvf kewhats-deploy.tar.gz
cd kewhats-deploy
```

### 4. Install Node.js (jika belum)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v  # Pastikan v20+
```

### 5. Setup Backend
```bash
cd server

# Install dependencies
npm install

# Buat file .env
cp .env.example .env
nano .env
```

Edit `.env` dengan nilai berikut:
```env
NODE_ENV=production
PORT=3001
DATABASE_URL="file:./prod.db"
JWT_SECRET=GANTI_DENGAN_RANDOM_STRING_PANJANG_32_KARAKTER
FRONTEND_URL=https://YOUR_DOMAIN.com
```

Lanjut setup:
```bash
# Generate Prisma Client
npx prisma generate

# Jalankan migrasi database
npx prisma migrate deploy

# Test jalankan
npm start
```

### 6. Setup Frontend
```bash
cd ..  # kembali ke folder kewhats-deploy

# Install dependencies
npm install

# Buat file .env
echo 'VITE_API_URL=https://api.YOUR_DOMAIN.com/api' > .env

# Build production
npm run build
```

### 7. Setup Nginx

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/kewhats
```

Paste config ini:
```nginx
# Frontend
server {
    listen 80;
    server_name YOUR_DOMAIN.com;
    
    root /home/user/kewhats-deploy/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Backend API
server {
    listen 80;
    server_name api.YOUR_DOMAIN.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/kewhats /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. Setup PM2 (Process Manager)
```bash
sudo npm install -g pm2

cd /home/user/kewhats-deploy/server
pm2 start npm --name "kewhats-api" -- start
pm2 save
pm2 startup
```

### 9. Setup SSL (HTTPS)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN.com -d api.YOUR_DOMAIN.com
```

---

## SELESAI! 🎉

Akses aplikasi di:
- Frontend: https://YOUR_DOMAIN.com
- API: https://api.YOUR_DOMAIN.com

---

## Troubleshooting

### Network Error saat Login
- Pastikan `VITE_API_URL` correct saat build frontend
- Pastikan `FRONTEND_URL` di backend `.env` sesuai domain frontend

### CORS Error
- Cek `FRONTEND_URL` di backend `.env`
- Restart backend: `pm2 restart kewhats-api`

### Database Error
- Jalankan: `npx prisma migrate deploy`
- Cek permission folder: `chmod 755 /home/user/kewhats-deploy/server/prisma`

---

## Perintah Berguna

```bash
# Lihat log backend
pm2 logs kewhats-api

# Restart backend
pm2 restart kewhats-api

# Rebuild frontend (setelah edit .env)
npm run build

# Cek status
pm2 status
```
