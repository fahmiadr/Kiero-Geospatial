import os
import random
import sys
import time
import psycopg2
from psycopg2.extras import DictCursor
from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs
from collections import deque
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.progress import Progress, BarColumn, TextColumn, TimeRemainingColumn
from rich.status import Status
from rich.console import Group
from rich.prompt import Prompt

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
# Kita akan log setiap 5000 baris, tapi tidak ada commit manual
LOG_BATCH_SIZE = 5000 

console = Console()

def validate_config():
    if not DATABASE_URL:
        console.print("❌ [bold red]Error: Variabel DATABASE_URL belum diatur di file .env.[/bold red]")
        sys.exit(1)
    console.print("👍 [green]Konfigurasi berhasil dimuat dari .env[/green]")

def get_db_connection():
    try:
        parsed_url = urlparse(DATABASE_URL)
        query_params = parse_qs(parsed_url.query)
        schema = query_params.get('schema', [None])[0]
        # Hapus 'schema' dari DSN untuk psycopg2
        clean_dsn = parsed_url._replace(query="").geturl()

        conn = psycopg2.connect(dsn=clean_dsn)
        
        # Aktifkan Autocommit
        conn.autocommit = True
        console.print("✅ [bold yellow]Mode Autocommit Diaktifkan.[/bold yellow]")
        
        db_name = conn.get_dsn_parameters().get('dbname', 'N/A')
        host = conn.get_dsn_parameters().get('host', 'N/A')
        
        if schema:
            console.print(f"   [dim]Mengatur search_path ke schema: '{schema}'...[/dim]")
            with conn.cursor() as cursor:
                cursor.execute(f"SET search_path = %s", (schema,))
            console.print(f"🔌 [green]Berhasil terhubung ke database '{db_name}' di {host} (Schema: '{schema}').[/green]")
        else:
            console.print(f"🔌 [green]Berhasil terhubung ke database '{db_name}' di {host} (Schema: default).[/green]")

        return conn
        
    except psycopg2.Error as e:
        console.print(f"❌ [bold red]Gagal terhubung ke database PostgreSQL: {e}[/bold red]")
        return None
    except Exception as e:
        console.print(f"❌ [bold red]Error parsing DATABASE_URL: {e}[/bold red]")
        return None

def fetch_all_desas(conn):
    """
    Mengambil daftar lengkap semua desa (regions level 'desa')
    yang memiliki geometri valid.
    """
    try:
        with conn.cursor(cursor_factory=DictCursor) as cursor:
            query = """
            SELECT 
                d.id as region_id, d.nama as village, k.nama as district,
                kb.nama as city, p.nama as province
            FROM regions d
            JOIN regions k ON d.kode_kec = k.kode_kec AND d.kode_kab = k.kode_kab AND d.kode_prov = k.kode_prov AND k.level = 'kecamatan'
            JOIN regions kb ON d.kode_kab = kb.kode_kab AND d.kode_prov = kb.kode_prov AND kb.level = 'kab_kota'
            JOIN regions p ON d.kode_prov = p.kode_prov AND p.level = 'provinsi'
            WHERE d.level = 'desa' AND d.geom IS NOT NULL
            """
            with Status("🗺️  Mengambil data semua desa dari tabel regions...", spinner="dots", console=console):
                cursor.execute(query)
                results = cursor.fetchall()
            
            results_list = [dict(row) for row in results]
            
            console.print(f"✅ [green]Berhasil mengambil {len(results_list):,} data desa yang valid.[/green]")
            return results_list
            
    except psycopg2.Error as e:
        console.print(f"❌ [bold red]Gagal mengambil data wilayah: {e}[/bold red]")
        return []

def fetch_tickets_to_update(conn, update_all=False):
    """
    Mengambil HANYA ID tiket yang akan di-update.
    """
    try:
        with conn.cursor(cursor_factory=DictCursor) as cursor:
            base_query_fields = "SELECT id FROM tickets ORDER BY id"
            
            if update_all:
                query = base_query_fields
                status_msg = "🎫 Mengambil ID SEMUA tiket..."
            else:
                # Opsi 1 (Mode 'Kosong') masih akan menimpa tiket kosong
                # dengan data acak, BUKAN mencocokkan.
                query = f"SELECT id FROM tickets WHERE coordinates IS NULL OR ST_Equals(coordinates, ST_PointFromText('POINT(0 0)', 4326)) OR ST_IsEmpty(coordinates) ORDER BY id"
                status_msg = "🎫 Mencari tiket yang perlu di-update (koordinat kosong)..."

            with Status(status_msg, spinner="dots", console=console):
                cursor.execute(query)
                results = cursor.fetchall()
                
            results_list = [dict(row) for row in results]
            
            if update_all:
                console.print(f"✅ [green]Ditemukan {len(results_list):,} total tiket untuk ditimpa (mode: SEMUA).[/green]")
            else:
                console.print(f"✅ [green]Ditemukan {len(results_list):,} tiket kosong untuk ditimpa (mode: KOSONG SAJA).[/green]")
                
            return results_list
            
    except psycopg2.Error as e:
        console.print(f"❌ [bold red]Gagal mengambil daftar tiket: {e}[/bold red]")
        return []


def perform_updates_row_by_row(cursor, tickets_to_update, all_desas, conn):
    """
    Menimpa data tiket dengan data desa acak dari all_desas,
    lalu menjalankan UPDATE baris-per-baris.
    """
    console.print("\n--- [bold yellow]Memulai Proses Update Baris-per-Baris (Mode: Autocommit / Random Replacement)[/bold yellow] ---")
    
    # --- TIDAK PERLU HASH MAP ---
    
    total_tickets = len(tickets_to_update)
    
    progress_bar = Progress(
        TextColumn("🔄 Menimpa Data"), BarColumn(),
        "[progress.percentage]{task.percentage:>3.0f}%",
        "({task.completed} dari {task.total})", TimeRemainingColumn(),
        transient=True
    )
    
    log_messages = deque(maxlen=5)
    for _ in range(5): log_messages.append("")
    
    log_panel = Panel(
        "\n".join(log_messages), 
        title="[blue]Detail Logs[/blue]", 
        height=7, 
        border_style="dim"
    )
    render_group = Group(log_panel, progress_bar)
    
    task_id = progress_bar.add_task("update", total=total_tickets)

    # --- Kueri SQL diperbarui untuk JITTER (kompatibel) ---
    # Kueri ini sekarang meng-update SEMUA kolom lokasi
    update_query = """
        UPDATE tickets t
        SET
            region_id = %s,
            coordinates = (
                WITH centroid AS (
                    SELECT ST_PointOnSurface(r.geom) as pt
                )
                SELECT ST_SetSRID(
                    ST_MakePoint(
                        ST_X(pt) + (random() - 0.5) * 0.01, -- Jitter X (~550m)
                        ST_Y(pt) + (random() - 0.5) * 0.01  -- Jitter Y (~550m)
                    ),
                    4326 -- Set SRID ke WGS84
                )
                FROM centroid
            )
        FROM regions r
        WHERE
            t.id = %s AND r.id = %s 
            -- r.id dicocokkan dengan region_id yang baru di-random
    """
    
    replaced_count = 0
    error_count = 0
    
    with Live(render_group, console=console) as live:
        for i, ticket in enumerate(tickets_to_update):
            
            ticket_id = ticket['id']
            
            # --- LOGIKA UTAMA TUGAS A ---
            # Pilih desa acak dari daftar 84.000+
            random_desa = random.choice(all_desas)
            
            # Siapkan data baru
            new_region_id = random_desa['region_id']
            # --- AKHIR LOGIKA UTAMA ---

            try:
                # Jalankan update untuk 1 tiket
                cursor.execute(
                    update_query, 
                    (
                        new_region_id,
                        ticket_id, new_region_id 
                    )
                )
                
                log_msg = f"Update [bold yellow]ID: {ticket_id}[/bold yellow] -> [cyan]Diganti dgn: '{new_village}'[/cyan] -> [bold green]REPLACED[/bold green]"
                log_messages.append(log_msg)
                replaced_count += 1
                
            except psycopg2.Error as e:
                # Tangani error per baris (misal geometri tidak valid)
                error_count += 1
                error_msg = str(e).splitlines()[0] 
                log_msg = f"❌ [red]Gagal update ID: {ticket_id} | Desa: {new_village} | Error: {error_msg}[/red]"
                log_messages.append(log_msg)
            
            # Log per batch (TIDAK ADA COMMIT)
            if (i + 1) % LOG_BATCH_SIZE == 0:
                log_messages.append(f"[bold dim]... {i + 1} baris diproses ...[/bold dim]")
                live.refresh()
            
            log_panel.renderable = "\n".join(log_messages)
            progress_bar.update(task_id, advance=1)

        log_messages.append(f"[bold green]✅ Pemrosesan selesai.[/bold green]")
        live.refresh()

    console.print("✅ [green]Semua data berhasil diproses.[/green]")
    console.print(f"   [green]Berhasil Ditimpa (Replaced):[/green] {replaced_count:,} tiket")
    console.print(f"   [red]Gagal Update (Error Geometri/DB):[/red] {error_count:,} tiket")
    
    # Kembalikan jumlah baris yang berhasil diupdate
    return replaced_count


def main():
    console.print("🚀 [bold blue]Memulai script update lokasi tiket (Mode: Random Replacement)[/bold blue]")
    
    console.print("\n[bold yellow]Pilih mode update:[/bold yellow]")
    console.print("  [bold]1[/bold]: Timpa (replace) tiket dengan koordinat kosong/default (0,0) [bold]dengan data acak baru[/bold].")
    console.print("  [bold]2[/bold]: Timpa (replace) SEMUA tiket [bold]dengan data acak baru[/bold]. (Lambat)")
    choice = Prompt.ask("Masukkan pilihan (1/2)", choices=["1", "2"], default="1")
    
    update_all = (choice == "2")
    
    limit_rows_str = Prompt.ask(
        "\n[bold yellow]Masukkan jumlah batas (limit) baris[/bold yellow] (Opsional, tekan [green]Enter[/green] untuk memproses semua)", 
        default="0"
    )
    limit_rows = 0
    try:
        limit_rows = int(limit_rows_str)
        if limit_rows < 0: limit_rows = 0
    except ValueError:
        limit_rows = 0
    
    if update_all:
        console.print("⚠️  [bold red]Mode: Timpa SEMUA tiket.[/bold red] Ini akan me-random ulang lokasi semua tiket yang ada.")
    else:
        console.print("✅ [bold green]Mode: Timpa tiket kosong saja.[/bold green]")
    
    validate_config()
    
    conn = get_db_connection()
    if not conn: return

    cursor = None
    updated_rows = 0
    start_time = time.time()
    try:
        # Ambil data region (dilakukan di luar transaksi utama)
        all_desas = fetch_all_desas(conn)
        if not all_desas: 
            console.print("⚠️ [yellow]Tidak ada data desa valid yang ditemukan. Proses dihentikan.[/yellow]")
            return

        # Ambil tiket (juga di luar transaksi utama)
        ticket_ids_to_update = fetch_tickets_to_update(conn, update_all=update_all)
        
        if limit_rows > 0 and len(ticket_ids_to_update) > limit_rows:
            console.print(f"✅ [bold magenta]MEMBATASI[/bold magenta] proses dari {len(ticket_ids_to_update):,} tiket menjadi [bold]{limit_rows:,}[/bold] tiket untuk testing.")
            ticket_ids_to_update = ticket_ids_to_update[:limit_rows] # Slice the list
        elif limit_rows > 0:
            console.print(f"✅ [bold green]Batas {limit_rows:,}[/bold green] tiket diatur, tetapi hanya {len(ticket_ids_to_update):,} tiket yang ditemukan.")
        else:
            console.print(f"✅ [bold green]Tidak ada batas (limit) yang diatur[/bold green], memproses semua tiket yang ditemukan.")
        
        if not ticket_ids_to_update:
            console.print("🎉 [green]Tidak ada tiket yang perlu diupdate. Selesai.[/green]")
            return
        
        # --- Mulai Operasi Transaksional ---
        # Buat kursor utama untuk operasi UPDATE
        cursor = conn.cursor()
        
        # Panggil fungsi update row-by-row
        updated_rows = perform_updates_row_by_row(cursor, ticket_ids_to_update, all_desas, conn)
        # --- Akhir Operasi Transaksional ---
        
    except psycopg2.Error as e:
        console.print(f"\n❌ [bold red]Terjadi error saat proses database: {e}[/bold red]")
        # Tidak perlu rollback, autocommit aktif
    except KeyboardInterrupt:
        console.print("\n🛑 [bold yellow]Proses dihentikan oleh pengguna.[/bold yellow]")
        # Tidak perlu rollback
    except Exception as e:
        console.print(f"\n❌ [bold red]Terjadi error tak terduga: {e}[/bold red]")
        # Tidak perlu rollback
    finally:
        if cursor:
            cursor.close()

    total_duration = time.time() - start_time
    rows_per_sec = updated_rows / total_duration if total_duration > 0 else 0
    
    console.print(f"\n--- [bold green]Update Selesai[/bold green] ---")
    console.print(f"⏱️  [bold]Durasi Total:[/bold] {total_duration:.2f} detik")
    console.print(f"📊 [bold]Total Baris:[/bold] {updated_rows} baris berhasil ditimpa (replaced).")
    console.print(f"⚡ [bold]Performa:[/bold] {rows_per_sec:.2f} baris/detik")
    
    if conn and not conn.closed:
        # Nonaktifkan autocommit sebelum menutup
        try:
            conn.autocommit = False
        except psycopg2.Error:
            pass # Koneksi mungkin sudah bermasalah
        conn.close()
        console.print("🔌 [dim]Koneksi ke database ditutup.[/dim]")

if __name__ == "__main__":
    main()

