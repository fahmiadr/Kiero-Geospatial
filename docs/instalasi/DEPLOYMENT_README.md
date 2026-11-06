# Deployment Guide for Geomap App

This guide covers how to prepare, test, and deploy the application to a Linux server using Docker.

## 1. Prerequisites

### Local Machine (Windows)
- Docker Desktop installed and running.
- PowerShell or Terminal.
- Node.js.

### Remote Server (Linux)
- Ubuntu/Debian (recommended).
- Docker and Docker Compose plugin installed.
- **OpenSSL** (usually pre-installed) for generating certificates.
- **Ports**: Ensure ports 80 and 443 are open.

## 2. Configuration Setup

1.  **Environment Variables**:
    Copy the example file to `.env`:
    ```powershell
    cp .env.example .env
    ```
    Edit `.env` and fill in your real values.

2.  **Generate Gateway Keys (JWT)**:
    ```powershell
    cd geo-gateway
    npm install
    npm run generate_gateway_keys
    move gateway_private.pem ..\keys\
    move gateway_public.pem ..\keys\
    cd ..
    ```

3.  **Generate SSL Certificates (HTTPS)**:
    We use a shell script to generate a self-signed certificate valid for **10 years**.
    ```bash
    # Run locally (if you have git bash) or on server
    ./generate_ssl.sh
    # Result: keys/ssl/nginx.crt and keys/ssl/nginx.key
    ```

## 3. Local Testing & Development

To run the full stack locally with HTTPS and valid Auth, follow these steps:

1.  **Prepare Config**:
    Ensure you have a `.env` file with local DB credentials.
    ```powershell
    cp .env.example .env
    # Edit .env, ensure DB credentials match your local setup
    ```

2.  **Ensure Keys exist**:
    ```powershell
    # Generate the self-signed certificates locally just to satisfy the gateway config requirements if any
    ./generate_ssl.sh
    ```

3.  **Phase 1: Start Gateway & Backend**:
    ```powershell
    docker compose up -d gateway backend
    ```

4.  **Phase 2: Register Local Client**:
    Wait for gateway to accept connections, then:
    ```powershell
    docker compose exec gateway npm run register_client
    # Enter Name: Local Dev
    # Enter Origins: https://localhost,http://localhost
    # COPY THE CLIENT ID
    ```

5.  **Phase 3: Update Config & Start Frontend**:
    -   Paste the `CLIENT_ID` into your local `.env` as `VITE_CLIENT_ID`.
    -   Start the frontend:
        ```powershell
        docker compose up -d --build frontend
        ```

6.  **Access**: Open `http://localhost:14170` (HTTP). Note: local deployment no longer handles HTTPS out of the box.

## 4. Production Deployment

**Server Details**:
- **User**: icon
- **Password**: SSHPassword
- **IP**: 10.14.151.119

### Step 4.1: Prepare the Server
Server yang baru memerlukan instalasi Docker dan Nginx Global sebelum _deployment_ dilakukan.
Silakan rujuk ke panduan terpisah berikut untuk instalasi dan pengerasannya (hardening):

1. **[Panduan Instalasi Docker & Compose](DOCKER_INSTALLATION.md)** — Ikuti panduan ini untuk menginstal Docker secara bersih dengan Docker Compose V2 beserta solusi penanganan DNS-nya.
2. **[Panduan Instalasi & Optimasi Nginx](NGINX_INSTALLATION.md)** — Ikuti untuk instalasi Nginx di _Host OS_, penyetelan keamanan, dan Gzip/Brotli gzip/compression optimasi.

Setelah instalasi Docker dan Nginx selesai (terutama jika Anda baru ditambahkan ke grup `docker`, pastikan sudah logout dan login lagi), buat direktori proyek:

```bash
# Create Project Directories
# Ensure the project folder and logs directory exist
mkdir -p /home/icon/geomap/logs
```

### Step 4.1.5: Konfigurasi Firewall (UFW)
Sebelum melakukan deployment, pastikan port yang dibutuhkan oleh Geomap dan layanan web terbuka di *firewall* server Anda.

```bash
# Pastikan port SSH (22) izin akses terbuka agar Anda tidak terblokir dari server!
sudo ufw allow OpenSSH
# Atau secara manual: sudo ufw allow 22/tcp

# Port standar Web (Bila suatu saat dibutuhkan)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Publik port spesifik Geomap
sudo ufw allow 3000/tcp
sudo ufw allow 4170/tcp

# Aktifkan dan periksa status
sudo ufw enable
sudo ufw status
```

### Step 4.2: Clone Project via GitHub
**Pertama**, pastikan Anda telah menyiapkan SSH Deploy Key. Jika belum, pelajari panduannya di:
**[=> Panduan Setup GitHub SSH Deploy Key](GITHUB_DEPLOY_GUIDE.md)**

Setelah kunci GitHub Anda aktif, _clone repository_ terbaru ke dalam server:
```bash
# Pastikan berada di Home
cd /home/icon

# Lakukan Clone (Contoh format SSH github asli):
git clone git@github.com:USERNAME/map-batas-wilayah.git geomap
cd geomap

# Pastikan Anda mem-pull versi paling baru jika project sudah pernah di clone sebelumnya
git pull origin main
```

**Setup .env Keamanan**:
Konfigurasi _environment variable_ dilakukan langsung di server dengan menyalin file contoh yang tersedia.

Di terminal server:
```bash
cp .env.example .env
nano .env
# Edit nilai-nilai sesuai kebutuhan produksi
```

### Step 4.3: Deploy & Configure SSL
1.  **SSH into server**:
    ```powershell
    ssh icon@10.14.151.119
    cd /home/icon/geomap
    ```

2.  **Generate & Copy SSL Certs (One-time)**:
    ```bash
    chmod +x generate_ssl.sh renew_ssl.sh
    ./generate_ssl.sh
    
    # Copy to Host Nginx directory
    sudo cp keys/ssl/nginx.crt /etc/ssl/certs/geomap-selfsigned.crt
    sudo cp keys/ssl/nginx.key /etc/ssl/private/geomap-selfsigned.key
    ```

3.  **Setup Nginx Global**:
    *(Pastikan Nginx sudah diinstal dan dioptimalkan sesuai `NGINX_INSTALLATION.md`)*
    ```bash
    sudo cp nginx/geomap.conf /etc/nginx/sites-available/
    sudo ln -s /etc/nginx/sites-available/geomap.conf /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    ```

4.  **Phase 1: Start Backend/Gateway**:
    ```bash
    docker compose up -d gateway backend
    ```

5.  **Phase 2: Register Client**:
    ```bash
    docker compose exec gateway npm run register_client
    # Enter Name: Geomap Frontend
    # Enter Origins: http://10.14.151.119,https://10.14.151.119
    # COPY THE CLIENT ID
    ```

6.  **Phase 3: Update .env & Build Frontend**:
    ```bash
    nano .env
    # Update VITE_CLIENT_ID=your_new_client_id
    # Save & Exit
    
    docker compose up -d --build frontend
    ```

### Step 4.4: Auto-Renewal (Maintenance)
The certificate is valid for 10 years, so "renewal" is rarely needed. However, to satisfy requirements or if you shorten the validity, you can use the renewal script.

**Manual Check**:
```bash
./renew_ssl.sh
# Checks expiry (< 30 days). If expiring, regenerates, copies to /etc/ssl, and reloads Nginx.
```

**Auto-renewal via Cron (Optional)**:
Run every month:
```bash
crontab -e
# Add line:
0 0 1 * * /home/icon/geomap/renew_ssl.sh >> /home/icon/geomap/logs/ssl_renew.log 2>&1
```

## 5. Nginx & Architecture

The deployment uses a **Host Nginx Global Reverse Proxy** architecture.

### 1. Host Nginx Global
-   **Secure SSL**: Configured with TLS 1.2/1.3 and strong ciphers.
-   Handles all SSL Termination.
-   Proxies traffic from public ports (e.g. `4170`, `3000`) to internal container ports on loopback.

### 2. Container Nginx (Frontend)
-   Serves only static files and React SPA routing via port `80`.
-   No SSL management.
-   Implements Gzip Compression and asset caching logic.

### 3. Port Bindings
Ports for `gateway`, `backend`, and `frontend` are bound to `127.0.0.1` via standard offset ports:
- `14170` (Frontend, public `4170`)
- `13000` (Gateway, public `3000`)
- `13001` (Backend, purely internal)

This guarantees all traffic is secured and properly proxied by the Host Nginx.

## Appendix: Session Log (Troubleshooting & Decisions)

### 1. DNS Hijacking & Resolution Failure
**Issue**: `Temporary failure in name resolution` atau `404 Not Found` saat `apt update` / `apt install`.
**Cause**: Jaringan korporat/ISP melakukan **DNS Hijacking** — permintaan DNS dibelokkan sehingga `archive.ubuntu.com` di-resolve ke IP palsu (`208.91.112.55`, IP "parkir" milik Network Solutions) alih-alih IP asli server Ubuntu.

**Diagnosis**:
```bash
# 1. Cek apakah internet tersedia (ICMP)
ping -c 3 8.8.8.8

# 2. Cek apakah DNS dibelokkan
nslookup archive.ubuntu.com 8.8.8.8
# Jika hasilnya 208.91.112.55 → DNS Hijacked

# 3. Paksa apt gunakan IPv4 saja (IPv6 sering gagal di jaringan terbatas)
echo 'Acquire::ForceIPv4 "true";' | sudo tee /etc/apt/apt.conf.d/99force-ipv4
```

**Fix (Strategi Static DNS via `/etc/hosts`)**:
Mintas DNS sepenuhnya dengan mendaftarkan IP asli repositori Ubuntu langsung ke sistem.

**Langkah 1**: Scan IP mirror Ubuntu yang bisa diakses:
```bash
for ip in 185.125.190.36 185.125.190.39 91.189.91.81 91.189.91.82 91.189.91.83 91.189.91.84; do
  echo -n "Testing $ip... "
  curl -s -o /dev/null -w "HTTP %{http_code}" --connect-timeout 5 \
    "http://$ip/ubuntu/dists/noble/InRelease" -H "Host: archive.ubuntu.com"
  echo ""
done
# Cari IP yang mengembalikan HTTP 200
```

**Langkah 2**: Daftarkan IP yang berhasil (contoh: `91.189.91.82`):
```bash
echo "91.189.91.82 archive.ubuntu.com" | sudo tee -a /etc/hosts
echo "91.189.91.82 security.ubuntu.com" | sudo tee -a /etc/hosts
```

**Langkah 3**: Bersihkan cache lama dan update ulang:
```bash
sudo apt clean
sudo rm -rf /var/lib/apt/lists/*
sudo apt update
```

> **Catatan**: IP yang berhasil bisa berubah seiring waktu. Jika suatu saat `apt update` gagal lagi, ulangi proses scanning di Langkah 1 untuk menemukan IP baru yang aktif.

### 2. Docker Permission Denied
**Issue**: `permission denied while trying to connect to the Docker daemon socket`.
**Cause**: User `icon` was not part of the `docker` group.
**Fix**:
- Executed: `sudo usermod -aG docker icon`.
- **Important**: Required logging out and logging back in for group changes to take effect.

### 3. File Transfer Optimization
**Issue**: `scp` was slow or failed because it tried to verify thousands of files in `node_modules`.
**Decision**: Adopted a **"Whitelist Strategy"** using `robocopy` with `temp_upload`.
**Fix**:
- Strictly copy ONLY `backend`, `frontend`, `geo-gateway`, `keys`, `docker-compose.yml`, scripts, and config.
- Explicitly exclude `node_modules`, `logs`, `archives`, `.git`.

### 4. Client Registration (Bootstrap)
**Issue**: The Frontend needs a `VITE_CLIENT_ID` that doesn't exist yet before deployment.
**Fix**: **Phased Deployment**.
- Phase 1: Deploy Gateway & Backend only.
- Phase 2: Run `npm run register_client` inside the Gateway container.
- Phase 3: Take the new Client ID -> update server `.env` -> Build Frontend.

### 5. HTTPS & Mixed Content
**Issue**: Browser blocked API requests because Frontend was loaded via HTTPS but API calls were HTTP.
**Fix**: **Nginx Global Reverse Proxy**.
- Proxies requests from unified ports (e.g. `3000` via HTTPS directly to Gateway).
- Browser sees frontend & API as HTTPS, resolving Mixed Content seamlessly across both Livechat and Geomap.

### 6. APT 404 Not Found (Stale Package Metadata)
**Issue**: `apt install` mengembalikan `404 Not Found` meskipun koneksi ke server repositori berhasil.
**Cause**: Cache metadata lokal (`/var/lib/apt/lists/`) masih merujuk ke versi paket lama (misal `nginx 1.24.0-2ubuntu7`) yang sudah digantikan oleh versi baru di server (`1.24.0-2ubuntu7.6`). File `.deb` versi lama sudah dihapus dari repositori.
**Fix**:
```bash
# Hapus semua cache metadata lama
sudo apt clean
sudo rm -rf /var/lib/apt/lists/*

# Download metadata segar dari repositori
sudo apt update

# Ulangi instalasi (sekarang merujuk ke versi terbaru)
sudo apt install -y <package-name>
```
