import geopandas as gpd
import psycopg2
import pandas as pd
import os
from shapely.wkt import dumps
from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs
from rich.live import Live
from rich.panel import Panel
from rich.progress import Progress, BarColumn, TextColumn, TimeRemainingColumn
from rich.console import Group
from collections import deque
from rich.status import Status
from rich.console import Console

load_dotenv()

files_to_process = {
    'provinsi': '../../../Data Batas Wilayah Indonesia/geojson/topojson/ADM-PROVINSI-SIMPLIFIED.topojson',
    'kab_kota': '../../../Data Batas Wilayah Indonesia/geojson/topojson/ADM-KABKOTA-SIMPLIFIED.topojson',
    'kecamatan': '../../../Data Batas Wilayah Indonesia/geojson/topojson/ADM-KECAMATAN-SIMPLIFIED.topojson',
    'desa': '../../../Data Batas Wilayah Indonesia/geojson/topojson/ADM-KELURAHAN_DESA-SIMPLIFIED.topojson'
}

DATABASE_URL = os.getenv("DATABASE_URL")
console = Console()

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
        
    except psycopg2.Error as err:
        console.print(f"❌ [bold red]Gagal terhubung ke PostgreSQL: {err}[/bold red]")
        return None
    except Exception as e:
        console.print(f"❌ [bold red]Error parsing DATABASE_URL: {e}[/bold red]")
        return None

def migrate_data():
    
    console.print("🚀 [bold blue]Memulai proses migrasi data wilayah...[/bold blue]")
    conn = get_db_connection()
    if not conn:
        console.print("[bold red]Migration dibatalkan karena koneksi database gagal.[/bold red]")
        return

    cursor = conn.cursor()
    
    try:
        console.print("\n🗑️  [bold]Mengosongkan tabel 'regions'...[/bold]")
        
        console.print("   [dim]Menjalankan DELETE FROM regions...[/dim]")
        cursor.execute("DELETE FROM regions;")
        console.print("   [dim]Mereset sequence ID ke 1...[/dim]")
        cursor.execute("SELECT setval(pg_get_serial_sequence('regions', 'id'), 1, false);")

        conn.commit()
        console.print("✅ [green]Tabel 'regions' berhasil dikosongkan dan ID direset.[/green]")
    except psycopg2.Error as err:
        console.print(f"❌ [bold red]Gagal mengosongkan tabel: {err}[/bold red]")
        console.print("   [yellow]Info: Jika error ini adalah 'foreign key constraint',")
        console.print("   [yellow]pastikan tabel lain (seperti 'tickets') tidak memiliki data yang merujuk ke 'regions',")
        console.print("   [yellow]atau atur foreign key Anda ke 'ON DELETE SET NULL' atau 'ON DELETE CASCADE'.[/yellow]")
        conn.rollback()
        cursor.close()
        conn.close()
        return

    total_inserted = 0
    
    property_mappings = {
        'provinsi': {'nama': 'WADMPR', 'kode_prov': 'KDPPUM'},
        'kab_kota': {'nama': 'WADMKK', 'kode_prov': 'KDPPUM', 'kode_kab': 'KDPKAB', 'luas': 'LUAS'},
        'kecamatan': {'nama': 'WADMKC', 'kode_prov': 'KDPPUM', 'kode_kab': 'KDPKAB', 'kode_kec': 'KDCPUM'},
        'desa': {'nama': 'WADMKD', 'kode_prov': 'KDPPUM', 'kode_kab': 'KDPKAB', 'kode_kec': 'KDCPUM', 'luas': 'LUAS'}
    }

    for level, filepath in files_to_process.items():
        console.print(f"\n--- [bold]Memproses level '{level}':[/bold] {filepath} ---")
        
        if not os.path.exists(filepath):
            console.print(f"⚠️ [bold red]File tidak ditemukan: {filepath}[/bold red]")
            continue

        try:
            with Status(f"📖 Membaca fitur dari file...", spinner="dots", console=console):
                gdf = gpd.read_file(filepath)
            
            console.print(f"✅ [green]Berhasil membaca {len(gdf)} fitur dari file.[/green]")

        except Exception as e:
            console.print(f"❌ [bold red]Gagal membaca file {filepath}: {e}[/bold red]")
            continue
            
        insert_count = 0
        
        progress_bar = Progress(
            TextColumn("📥 Memasukkan data '{task.description}'"),
            BarColumn(),
            "[progress.percentage]{task.percentage:>3.0f}%",
            "({task.completed} dari {task.total} baris)",
            TimeRemainingColumn(),
            transient=True
        )
        
        log_messages = deque(maxlen=5)
        for _ in range(5): log_messages.append("")

        log_panel = Panel(
            "\n".join(log_messages),
            title="[blue]Detail Logs",
            height=7,
            border_style="dim"
        )
        
        render_group = Group(log_panel, progress_bar)
        task_id = progress_bar.add_task(f"'{level}'", total=len(gdf))

        with Live(render_group, console=console) as live:
            for index, row in gdf.iterrows():
                try:
                    mapping = property_mappings[level]
                    
                    nama = row.get(mapping.get('nama'))
                    nama_str = str(nama) if pd.notna(nama) else "N/A"

                    log_messages.append(f"Memproses baris {index}: {nama_str}")
                    log_panel.renderable = "\n".join(log_messages)
                    progress_bar.update(task_id, advance=1)
                    
                    tipe_adm = None if pd.isna(row.get('TIPADM')) else str(int(float(row.get('TIPADM'))))
                    kode_prov = row.get(mapping.get('kode_prov'))
                    kode_kab = row.get(mapping.get('kode_kab'))
                    kode_kec = row.get(mapping.get('kode_kec'))
                    luas_raw = (row.get(mapping.get('luas')) if mapping.get('luas') else None)
                    luas = None if pd.isna(luas_raw) else float(luas_raw)

                    geom_wkt = dumps(row.geometry)
                    
                    if geom_wkt is None or geom_wkt == 'GEOMETRYCOLLECTION EMPTY':
                        raise ValueError(f"Geometri kosong atau null (WKT: {geom_wkt})")

                    query = """
                        INSERT INTO regions (level, tipe_adm, nama, kode_prov, kode_kab, kode_kec, luas, geom)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326))
                    """
                    cursor.execute(query, (level, tipe_adm, nama, kode_prov, kode_kab, kode_kec, luas, geom_wkt))
                    insert_count += 1
                
                except psycopg2.Error as err:
                    live.console.print(f"❌ [bold red]Database error inserting row {index} for level '{level}': {err}[/bold red]")
                    conn.rollback()
                except Exception as e:
                    live.console.print(f"❌ [bold red]An unexpected error occurred at row {index} for level '{level}': {e}[/bold red]")
                    conn.rollback()
        
        conn.commit()
        total_inserted += insert_count
        console.print(f"✅ [green]Berhasil memasukkan {insert_count} baris untuk level '{level}'.[/green]")

    console.print(f"\n--- [bold blue]Migrasi Selesai. Total {total_inserted} baris berhasil dimasukkan ke database.[/bold blue] ---")
    cursor.close()
    conn.close()
    console.print("🔌 [dim]Koneksi ke database ditutup.[/dim]")

if __name__ == '__main__':
    migrate_data()

