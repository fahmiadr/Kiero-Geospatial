import os
import sys
import psycopg2
import re
from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs
from rich.console import Console
from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn
from rich.panel import Panel

# --- Konfigurasi ---
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
INPUT_FILE = "../../../Data Aset/[3].txt"
# --------------------

console = Console()

def get_db_connection():
    """Mendapatkan koneksi ke database PostgreSQL."""
    try:
        parsed_url = urlparse(DATABASE_URL)
        query_params = parse_qs(parsed_url.query)
        schema = query_params.get('schema', [None])[0]
        clean_dsn = parsed_url._replace(query="").geturl()

        conn = psycopg2.connect(dsn=clean_dsn)
        
        conn.autocommit = False 
        
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

def unpack_value(value: str) -> list[str]:
    """
    Mengubah string input menjadi list.
    - "Majenang" -> ["Majenang"]
    - "(Tegal, Brebes)" -> ["Tegal", "Brebes"]
    """
    value = value.strip()
    if value.startswith('(') and value.endswith(')'):
        unpacked = value[1:-1] # Hapus tanda kurung
        return [item.strip() for item in unpacked.split(',')]
    else:
        return [value]

def process_file(conn, cursor, file_path: str):
    """Membaca file dan memasukkan data ke database."""
    
    console.print(f"--- [bold]Membaca file input:[/bold] {file_path} ---")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        console.print(f"❌ [bold red]Error: File tidak ditemukan di '{file_path}'[/bold red]")
        return
    
    comma_splitter = re.compile(r',\s*(?![^()]*\))')
    
    parent_prefix = None
    total_lines = 0
    total_links_created = 0
    
    # Mapping untuk kolom kode di tabel regions
    level_to_column = {
        "kecamatan": "kode_kec",
        "kab_kota": "kode_kab",
        "provinsi": "kode_prov",
        "desa": "kode_kec"
    }

    # SQL Template
    sql_proc1_insert = """
        INSERT INTO phone_prefixes (prefix, description, parent_id)
        VALUES (%s, %s, %s)
        ON CONFLICT (prefix) DO NOTHING
        RETURNING id;
    """
    sql_proc1_get_id = "SELECT id FROM phone_prefixes WHERE prefix = %s"
    
    sql_proc2_template = """
        INSERT INTO phone_prefix_regions (phone_prefix_id, region_id)
        SELECT %s, r.id
        FROM regions r
        WHERE r.nama = %s AND r.level = %s AND r.{code_field} = %s
        ON CONFLICT (phone_prefix_id, region_id) DO NOTHING;
    """

    parent_prefix_from_file = lines[0].strip().replace('[', '').replace(']', '')
    console.print(f"🔍 [cyan]Mencari Parent Prefix ID untuk '{parent_prefix_from_file}'...[/cyan]")
    try:
        cursor.execute(sql_proc1_get_id, (parent_prefix_from_file,))
        result = cursor.fetchone()
        if not result:
            console.print(f"❌ [bold red]Parent prefix '{parent_prefix_from_file}' tidak ditemukan di tabel 'phone_prefixes'![/bold red]")
            console.print("   [yellow]Pastikan parent prefix (misal '2') sudah ada di database sebelum menjalankan skrip ini.[/yellow]")
            return
        parent_id = result[0]
        console.print(f"✅ [green]Parent Prefix ID ditemukan:[/green] {parent_id} (untuk prefix '{parent_prefix_from_file}')")
        
    except psycopg2.Error as e:
        console.print(f"❌ [bold red]Error saat mencari parent prefix: {e}[/bold red]")
        conn.rollback()
        return

    # Mulai proses file
    with Progress(
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeElapsedColumn(),
        console=console
    ) as progress:
        
        task = progress.add_task(f"Memproses {file_path}", total=len(lines) - 1)

        for line_num, line in enumerate(lines):
            line = line.strip()
            if line_num == 0 or not line: # Lewati baris pertama ([2]) dan baris kosong
                if line_num > 0:
                    progress.update(task, advance=1)
                continue
            
            parts = comma_splitter.split(line)
            
            if len(parts) == 4:
                # 1. Ekstrak data mentah
                prefix = parts[0].strip()
                raw_desc = parts[1].strip()
                raw_level = parts[2].strip()
                raw_code = parts[3].strip()
                
                if not prefix.isdigit():
                    console.print(f"\n⚠️ [yellow]Format prefix tidak dikenal di baris {line_num + 1}, dilewati:[/yellow] '{line}'")
                    progress.update(task, advance=1)
                    continue
            
            else:
                parts_space = line.split()
                if len(parts_space) == 4:
                    prefix = parts_space[0].strip()
                    raw_desc = parts_space[1].strip()
                    raw_level = parts_space[2].strip()
                    raw_code = parts_space[3].strip()
                    
                    if not prefix.isdigit():
                        console.print(f"\n⚠️ [yellow]Format prefix tidak dikenal di baris {line_num + 1}, dilewati:[/yellow] '{line}'")
                        progress.update(task, advance=1)
                        continue
                else:
                    console.print(f"\n⚠️ [yellow]Format tidak dikenal di baris {line_num + 1} (diharapkan 4 bagian), dilewati:[/yellow] '{line}'")
                    progress.update(task, advance=1)
                    continue

            # 2. "Unpack" data
            try:
                descriptions = unpack_value(raw_desc)
                levels = unpack_value(raw_level)
                codes = unpack_value(raw_code)

                num_items = len(descriptions)

                # Validasi
                if len(codes) != num_items:
                    raise ValueError(f"Jumlah deskripsi ({len(descriptions)}) tidak sama dengan jumlah kode ({len(codes)})")
                
                # "Broadcast" level jika hanya ada 1
                if len(levels) == 1:
                    levels = levels * num_items
                elif len(levels) != num_items:
                    raise ValueError(f"Jumlah level ({len(levels)}) tidak cocok dengan jumlah deskripsi ({len(descriptions)})")
                
            except ValueError as e:
                console.print(f"\n❌ [bold red]Error data di baris {line_num + 1}: {e}[/bold red]")
                console.print(f"   [dim]LINE: {line}[/dim]")
                progress.update(task, advance=1)
                continue

            # 3. Jalankan PROSES 1: Buat/Ambil phone_prefix_id
            try:
                # Gunakan deskripsi gabungan untuk kolom deskripsi
                full_description = ", ".join(descriptions)
                
                cursor.execute(sql_proc1_insert, (prefix, full_description, parent_id))
                result = cursor.fetchone()
                
                if result:
                    phone_prefix_id = result[0]
                    console.print(f"   [dim]Prefix '{prefix}' dibuat dengan ID {phone_prefix_id}[/dim]")
                else:
                    cursor.execute(sql_proc1_get_id, (prefix,))
                    phone_prefix_id = cursor.fetchone()[0]
                    console.print(f"   [dim]Prefix '{prefix}' sudah ada (ID {phone_prefix_id})[/dim]")
                
                # 4. Jalankan PROSES 2: Loop dan hubungkan regions
                links_in_this_line = 0
                for desc, level, code in zip(descriptions, levels, codes):
                    
                    code_field = level_to_column.get(level)
                    if not code_field:
                        console.print(f"\n⚠️ [yellow]Level tidak dikenal '{level}' di baris {line_num + 1}, dilewati.[/yellow]")
                        continue
                        
                    sql_proc2 = sql_proc2_template.format(code_field=code_field)
                    
                    # Jalankan insert link
                    cursor.execute(sql_proc2, (phone_prefix_id, desc, level, code))
                    links_in_this_line += 1
                
                total_links_created += links_in_this_line
                total_lines += 1

            except psycopg2.Error as e:
                console.print(f"\n❌ [bold red]Error database di baris {line_num + 1}: {e}[/bold red]")
                console.print(f"   [dim]LINE: {line}[/dim]")
                console.print("   [bold red]Rollback... Proses dihentikan.[/bold red]")
                conn.rollback() # Rollback jika ada error
                return # Hentikan skrip
            
            progress.update(task, advance=1)

    # Jika semua berhasil, commit transaksi
    console.print("\n--- [bold green]Proses Selesai[/bold green] ---")
    console.print(f"✅ [green]Berhasil memproses {total_lines} baris data.[/green]")
    console.print(f"✅ [green]Berhasil membuat/memperbarui {total_links_created} relasi di 'phone_prefix_regions'.[/green]")
    console.print("   [cyan]Melakukan commit ke database...[/cyan]")
    conn.commit()
    console.print("✅ [bold green]Commit berhasil![/bold green]")


def main():
    console.print(Panel(f"🚀 [bold blue]Memulai Skrip Impor Prefix Telepon[/bold blue]\n[dim]Membaca dari: {INPUT_FILE}[/dim]", border_style="blue"))
    
    conn = get_db_connection()
    if not conn:
        return

    cursor = None
    try:
        cursor = conn.cursor()
        process_file(conn, cursor, INPUT_FILE)
        
    except KeyboardInterrupt:
        console.print("\n🛑 [bold yellow]Proses dihentikan oleh pengguna. Melakukan Rollback...[/bold yellow]")
        if conn:
            conn.rollback()
    except Exception as e:
        console.print(f"\n❌ [bold red]Terjadi error tak terduga: {e}[/bold red]")
        if conn:
            conn.rollback()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
            console.print("🔌 [dim]Koneksi ke database ditutup.[/dim]")

if __name__ == "__main__":
    main()