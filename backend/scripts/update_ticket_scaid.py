import os
import sys
import psycopg2
import time
from itertools import cycle
from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs
from collections import deque
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.progress import Progress, BarColumn, TextColumn, TimeRemainingColumn
from rich.status import Status
from rich.console import Group

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
COMMIT_BATCH_SIZE = 5000
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
        clean_dsn = parsed_url._replace(query="").geturl()
        conn = psycopg2.connect(dsn=clean_dsn)
        
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

def fetch_data(conn, query):
    """Mengambil data dari database dan mengembalikan list."""
    try:
        cursor = conn.cursor()
        cursor.execute(query)
        results = cursor.fetchall()
        return [row[0] for row in results]
    except psycopg2.Error as e:
        console.print(f"❌ [bold red]Gagal mengambil data: {e}[/bold red]")
        return []

def main():
    console.print("🚀 [bold blue]Memulai skrip untuk update 'category_id' tiket...[/bold blue]")
    validate_config()

    console.print("\nSilakan pilih mode update:")
    console.print("  [yellow]1[/yellow]. Update SEMUA baris (menimpa data category_id yang sudah ada).")
    console.print("  [yellow]2[/yellow]. Update HANYA baris yang kolom category_id-nya kosong (NULL).")
    
    choice = console.input("Masukkan pilihan Anda (1 atau 2): ")

    if choice == '1':
        fetch_query = "SELECT id FROM tickets ORDER BY id"
        console.print("\n[cyan]Mode dipilih: Mengupdate SEMUA tiket.[/cyan]")
    elif choice == '2':
        fetch_query = "SELECT id FROM tickets WHERE category_id IS NULL ORDER BY id"
        console.print("\n[cyan]Mode dipilih: Mengupdate tiket dengan 'category_id' KOSONG.[/cyan]")
    else:
        console.print("❌ [bold red]Pilihan tidak valid. Proses dihentikan.[/bold red]")
        sys.exit(1)
    
    conn = get_db_connection()
    if not conn:
        return

    start_time = time.time()
    cursor = None
    success_count = 0
    try:
        with Status("🔍 Mengambil ID tiket dari database...", spinner="dots", console=console):
            ticket_ids = fetch_data(conn, fetch_query)
        
        if not ticket_ids:
            console.print("⚠️ [yellow]Tidak ada tiket yang sesuai dengan kriteria untuk diupdate. Proses selesai.[/yellow]")
            return

        with Status("📚 Mengambil daftar 'category_id' dari database...", spinner="dots", console=console):
            scaid_list = fetch_data(conn, "SELECT category_id FROM category_systemcode")
            
        if not scaid_list:
            console.print("⚠️ [yellow]Tidak ada 'category_id' yang ditemukan di 'category_systemcode'. Proses dihentikan.[/yellow]")
            return
            
        console.print(f"✅ [green]Ditemukan {len(ticket_ids):,} tiket untuk diupdate dan {len(scaid_list)} kategori category_id.[/green]")
        console.print("\n--- [bold]Memulai Proses Update[/bold] ---")

        cursor = conn.cursor()
        scaid_cycle = cycle(scaid_list)

        progress_bar = Progress(
            TextColumn("🔄 Mengupdate tiket"),
            BarColumn(),
            "[progress.percentage]{task.percentage:>3.0f}%",
            "({task.completed} dari {task.total})",
            TimeRemainingColumn(),
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
        task_id = progress_bar.add_task("update", total=len(ticket_ids))

        with Live(render_group, console=console) as live:
            for i, ticket_id in enumerate(ticket_ids):
                scaid_to_assign = next(scaid_cycle)
                update_query = "UPDATE tickets SET category_id = %s WHERE id = %s"
                
                cursor.execute(update_query, (scaid_to_assign, ticket_id))
                
                log_msg = f"Update [bold yellow]ID: {ticket_id}[/] -> [bold cyan]category_id: '{scaid_to_assign}'[/]"
                log_messages.append(log_msg)
                
                if (i + 1) % COMMIT_BATCH_SIZE == 0:
                    conn.commit()
                    log_messages.append(f"[bold green]✅ Batch di-commit! ({i + 1} baris diproses)[/bold green]")
                
                log_panel.renderable = "\n".join(log_messages)
                progress_bar.update(task_id, advance=1)

            conn.commit()
            success_count = len(ticket_ids)
            live.console.print(f"--- [bold green]Transaksi Final Berhasil[/bold green] ---")

    except psycopg2.Error as e:
        console.print(f"\n❌ [bold red]Terjadi error saat update database: {e}[/bold red]")
        console.print("--- [bold red]Transaksi Gagal, Melakukan Rollback[/bold red] ---")
        if conn and not conn.closed:
            conn.rollback()
        success_count = 0
    except KeyboardInterrupt:
        console.print("\n🛑 [bold yellow]Proses dihentikan oleh pengguna.[/bold yellow]")
        if conn and not conn.closed:
            conn.rollback()
        success_count = 0

    finally:
        if conn and not conn.closed:
            if cursor:
                cursor.close()
            conn.close()
            
    total_duration = time.time() - start_time
    rows_per_sec = success_count / total_duration if total_duration > 0 else 0

    console.print(f"\n--- [bold green]Update Selesai[/bold green] ---")
    console.print(f"⏱️  [bold]Durasi Total:[/bold] {total_duration:.2f} detik")
    console.print(f"📊 [bold]Total Baris:[/bold] {success_count} baris berhasil diupdate.")
    console.print(f"⚡ [bold]Performa:[/bold] {rows_per_sec:.2f} baris/detik")
    console.print("🔌 [dim]Koneksi ke database ditutup.[/dim]")


if __name__ == "__main__":
    main()
