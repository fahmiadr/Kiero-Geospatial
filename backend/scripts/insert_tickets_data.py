import os
import sys
import psycopg2
import random
import uuid
import string
import time
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta
from dotenv import load_dotenv
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.progress import Progress, BarColumn, TextColumn, TimeRemainingColumn, SpinnerColumn

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

console = Console()
TARGET_ROWS = 10000  # Jumlah baris yang ingin digenerate
COMMIT_BATCH_SIZE = 1000

# ==========================================
# DATA POOLS (HARDCODED DARI TICKETS.CSV)
# ==========================================

# Data ini diambil dari sampel file tickets.csv yang anda berikan
STATUSES = ['Closed', 'Open', 'Pending']
PRIORITIES = ['Normal']
CHANNEL_SOURCES = ['Call']
CHANNEL_TYPES = ['Inbound']
ACCOUNT_NAMES = ['Rizki Malik', 'PT Aneka 123', 'guest customer call']
CREATED_BYS = ['root']
SLAS = [48]
CUSTOMER_IDS = [
    '20251110224145',
    '20251115124851'
]
COMPLAINT_DETAILS = [
    "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Earum, ut tempora. Quas minima recusandae consequuntur, molestias adipisci rerum. Quod nesciunt enim magnam optio provident nemo asperiores exercitationem quasi tenetur quas!"
]

RESPONSE_DETAILS = [
    "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Earum, ut tempora. Quas minima recusandae consequuntur, molestias adipisci rerum. Quod nesciunt enim magnam optio provident nemo asperiores exercitationem quasi tenetur quas!"
]

def get_db_connection():
    """Membuat koneksi ke database PostgreSQL."""
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

def random_date(start_year=2024, end_year=2025):
    """Menghasilkan datetime acak antara start_year dan end_year."""
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    return start + (end - start) * random.random()

def generate_random_row():
    """
    Membuat 1 baris data acak menggunakan kombinasi dari List Hardcoded di atas.
    """
    
    # Generate ID dan Nomor Unik
    ticket_id = str(uuid.uuid4())
    ticket_number = ''.join(random.choices(string.digits, k=10))
    customer_id = random.choice(CUSTOMER_IDS)
    
    # Ambil data acak dari pool yang sudah di-hardcode
    status = random.choice(STATUSES)
    priority = random.choice(PRIORITIES)
    source = random.choice(CHANNEL_SOURCES)
    c_type = random.choice(CHANNEL_TYPES)
    cat_id = random.choice(range(1, 7))
    sub_cat_id = random.choice(range(1, 32))
    complaint = random.choice(COMPLAINT_DETAILS)
    response = random.choice(RESPONSE_DETAILS)
    account = random.choice(ACCOUNT_NAMES)
    agent = random.choice(CREATED_BYS)
    sla_val = random.choice(SLAS)
    
    # Generate Waktu
    created_at = random_date()
    
    # Logika Closed Date
    closed_at = None
    if status == 'Closed':
        # Tiket closed biasanya selesai beberapa jam/hari setelah created
        closed_at = created_at + timedelta(hours=random.randint(1, 72))
        closed_by = agent
    else:
        closed_by = None

    # Return Tuple Data (Sesuai urutan kolom di database)
    return (
        ticket_id,          # id
        customer_id,        # customer_id
        ticket_number,      # ticket_number
        status,             # status
        cat_id,             # category_id
        sub_cat_id,         # category_sub_id
        None,               # customer_id_merge
        None,               # customer_id_origin
        complaint,          # complaint_detail
        response,           # response_detail
        sla_val,            # sla
        None,               # remark
        None,               # thread_id
        None,               # account_id
        account,            # account_name
        agent,              # last_response_by
        created_at,         # last_response_at (disamakan dengan created untuk simulasi)
        source,             # channel_source
        c_type,             # channel_type
        closed_at,          # closed_at
        closed_by,          # closed_by
        created_at,         # created_at
        agent,              # created_by
        agent,              # assign_to_user
        None,               # assign_to_team
        priority,           # priority
        None,               # reference_id
        None,               # team_id
        None,               # region_id (DI-HARDCODE NULL)
        None,               # coordinates (DI-HARDCODE NULL)
        None                # notif_email
    )

def main():
    console.rule("[bold blue]Generator Tiket (Data Hardcoded dari CSV)[/bold blue]")
    
    if not DATABASE_URL:
        console.print("[bold red]Error: DATABASE_URL tidak ditemukan di .env[/bold red]")
        return

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        progress = Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeRemainingColumn(),
            TextColumn("[bold blue]{task.completed}/{task.total} Tickets[/bold blue]")
        )

        insert_query = """
        INSERT INTO tickets (
            id, customer_id, ticket_number, status, category_id, category_sub_id,
            customer_id_merge, customer_id_origin, complaint_detail, response_detail,
            sla, remark, thread_id, account_id, account_name, last_response_by,
            last_response_at, channel_source, channel_type, closed_at, closed_by,
            created_at, created_by, assign_to_user, assign_to_team, priority,
            reference_id, team_id, region_id, coordinates, notif_email
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s
        )
        """

        with Live(Panel(progress, title="Generating Data", border_style="green"), refresh_per_second=10) as live:
            task_id = progress.add_task("Generating & Inserting...", total=TARGET_ROWS)
            
            batch_data = []
            start_time = time.time()

            for i in range(TARGET_ROWS):
                row_data = generate_random_row()
                batch_data.append(row_data)
                
                progress.update(task_id, advance=1)

                if len(batch_data) >= COMMIT_BATCH_SIZE:
                    cursor.executemany(insert_query, batch_data)
                    conn.commit()
                    batch_data = []

            if batch_data:
                cursor.executemany(insert_query, batch_data)
                conn.commit()

            duration = time.time() - start_time
            rows_per_sec = TARGET_ROWS / duration if duration > 0 else 0

        console.print("\n✅ [bold green]Proses Selesai![/bold green]")
        console.print(f"📊 [bold]Total Data:[/bold] {TARGET_ROWS}")
        console.print(f"⏱️  [bold]Durasi:[/bold] {duration:.2f} detik")
        console.print(f"⚡ [bold]Kecepatan:[/bold] {rows_per_sec:.2f} rows/sec")
        console.print("ℹ️  Data coordinates & region_id diset ke NULL.")

    except KeyboardInterrupt:
        console.print("\n🛑 Proses dihentikan user.")
        conn.rollback()
    except Exception as e:
        console.print(f"\n❌ Error: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
        console.print("🔌 Koneksi ditutup.")

if __name__ == "__main__":
    main()