import csv
import json
import sys
from pathlib import Path
from collections import defaultdict
from thefuzz import process, fuzz
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn

# --- KONFIGURASI FILE ---
# DIPERBARUI: Menggunakan file CSV baru Anda yang lebih detail
CSV_INPUT_FILE = Path("../../../Data Aset/regions2.csv") 
JSON_INPUT_FILE = Path("../../../Data Aset/hasil_analisis_populasi_final_normalized.json")

# Nama file output baru
JSON_OUTPUT_PERFECT = Path("../../../Data Aset/hasil_cocok_100_persen.json")
JSON_OUTPUT_FUZZY = Path("../../../Data Aset/hasil_cocok_fuzzy.json")
JSON_OUTPUT_NONE = Path("../../../Data Aset/hasil_tidak_cocok.json")

# Skor fuzzy match minimum (dari 100) untuk dipertimbangkan sebagai kecocokan
MIN_FUZZY_SCORE_THRESHOLD = 70
# ------------------------

console = Console()

def load_regions(csv_path: Path) -> tuple[dict, list]:
    """
    Membaca regions.csv ke dalam dua struktur data untuk pencocokan cepat.
    
    Returns:
        tuple: (name_to_rows_lookup, fuzzy_choices)
               - name_to_rows_lookup: dict {str: list[dict]}
               - fuzzy_choices: list [str]
    """
    # Menggunakan defaultdict untuk secara otomatis menangani list untuk nama duplikat
    name_to_rows_lookup = defaultdict(list)
    fuzzy_choices_set = set() # Menggunakan set untuk memastikan nama unik
    total_rows = 0 # Variabel baru untuk menghitung total baris

    try:
        with csv_path.open('r', encoding='utf-8') as f:
            # Hitung total baris untuk progress bar
            temp_reader = csv.reader(f)
            total_rows = sum(1 for row in temp_reader) - 1
            f.seek(0)
            
            reader = csv.DictReader(f)
            
            with Progress(
                SpinnerColumn(),
                TextColumn("Memuat {task.description}..."),
                BarColumn(),
                "[progress.percentage]{task.percentage:>3.0f}%",
                TimeElapsedColumn(),
                console=console,
                transient=True
            ) as progress:
                task = progress.add_task(f"[cyan]data {csv_path.name}[/]", total=total_rows)
                
                for row in reader:
                    nama = row.get('nama')
                    if not nama:
                        progress.update(task, advance=1)
                        continue
                        
                    # DIPERBARUI: Menambahkan lebih banyak data dari regions2.csv
                    region_data = {
                        "id": int(row.get('id', 0)),
                        "level": row.get('level'),
                        "nama": nama,
                        "kode_prov": row.get('kode_prov'),
                        "kode_kab": row.get('kode_kab'),
                        "kode_kec": row.get('kode_kec')
                    }
                    
                    # 1. Tambahkan ke daftar fuzzy HANYA JIKA unik
                    fuzzy_choices_set.add(nama)
                    
                    # 2. Tambahkan data ke lookup, 
                    #    ini akan membuat list jika ada nama yang sama
                    name_to_rows_lookup[nama].append(region_data)
                         
                    progress.update(task, advance=1)
                         
    except FileNotFoundError:
        console.print(f"❌ [bold red]Error: File CSV tidak ditemukan di '{csv_path}'[/bold red]")
        sys.exit(1)
    except Exception as e:
        console.print(f"❌ [bold red]Gagal membaca file CSV: {e}[/bold red]")
        sys.exit(1)
    
    fuzzy_choices = list(fuzzy_choices_set)
    # DIPERBARUI: Pesan log ini diubah agar lebih akurat
    console.print(f"✅ [green]Berhasil memuat {total_rows:,} total data baris, yang dikelompokkan menjadi {len(fuzzy_choices):,} nama unik.[/green]")
    return name_to_rows_lookup, fuzzy_choices


def process_json_data(json_path: Path, lookups: tuple) -> tuple[dict, dict, dict]:
    """
    Memproses file JSON dan membaginya menjadi tiga kamus berdasarkan hasil kecocokan.
    """
    name_to_rows_lookup, fuzzy_choices = lookups
    
    try:
        with json_path.open('r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        console.print(f"❌ [bold red]Error: File JSON tidak ditemukan di '{json_path}'[/bold red]")
        sys.exit(1)
    except json.JSONDecodeError:
        console.print(f"❌ [bold red]Error: File JSON '{json_path}' tidak valid.[/bold red]")
        sys.exit(1)

    console.print(f"🔥 [bold]Memulai pencocokan data...[/bold]")
    console.print(f"   [dim]Pencocokan 100% akan mengembalikan [bold]semua[/bold] wilayah dengan nama yang sama.[/dim]")
    
    # Buat tiga struktur output terpisah, salin kunci non-list (seperti metadata)
    perfect_match_output = {}
    fuzzy_match_output = {}
    no_match_output = {}
    
    for key, value in data.items():
        if isinstance(value, list):
            perfect_match_output[key] = []
            fuzzy_match_output[key] = []
            no_match_output[key] = []
        else:
            # Salin metadata
            perfect_match_output[key] = value
            fuzzy_match_output[key] = value
            no_match_output[key] = value

    total_processed = 0
    total_perfect_match = 0
    total_fuzzy_match = 0
    total_no_match = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("Mencocokkan {task.description}..."),
        BarColumn(),
        TextColumn("({task.completed}/{task.total})"),
        TimeElapsedColumn(),
        console=console
    ) as progress:
        total_items = sum(len(v) for v in data.values() if isinstance(v, list))
        task = progress.add_task(f"[cyan]entri JSON[/]", total=total_items)

        for key, item_list in data.items():
            if not isinstance(item_list, list):
                continue
            
            for item in item_list:
                prefix_desc = item.get("PrefixDesc")
                if not prefix_desc:
                    # Jika tidak ada PrefixDesc, anggap sebagai tidak cocok
                    item["OnRegion"] = None
                    no_match_output[key].append(item)
                    total_no_match += 1
                    progress.update(task, advance=1)
                    continue
                
                search_term = prefix_desc
                
                matches = process.extract(
                    search_term, 
                    fuzzy_choices, 
                    limit=5, # Diatur ke 5 kecocokan teratas
                    scorer=fuzz.WRatio
                )
                
                if not matches:
                    item["OnRegion"] = None
                    no_match_output[key].append(item)
                    total_no_match += 1
                    progress.update(task, advance=1)
                    continue

                best_match_name, best_score = matches[0]

                if best_score == 100:
                    # --- KECOCOKAN 100% ---
                    # Ambil SEMUA wilayah yang cocok dengan nama ini (bisa 1 atau lebih)
                    # Data ini sekarang berisi kode_prov, dll.
                    all_perfect_matches = name_to_rows_lookup[best_match_name]
                    item["OnRegion"] = all_perfect_matches # Ini adalah list
                    perfect_match_output[key].append(item)
                    total_perfect_match += 1
                else:
                    # --- KECOCOKAN FUZZY ---
                    top_matches_dict = {}
                    for match_name, score in matches: # Loop ini sekarang akan berjalan hingga 5 kali
                        if score >= MIN_FUZZY_SCORE_THRESHOLD:
                            # Ambil SEMUA wilayah yang cocok dengan nama fuzzy ini
                            # dan tambahkan ke kamus berdasarkan ID
                            matched_rows_list = name_to_rows_lookup[match_name]
                            for match_row in matched_rows_list:
                                match_id_str = str(match_row["id"])
                                match_row_with_score = match_row.copy()
                                match_row_with_score["match_score"] = score
                                top_matches_dict[match_id_str] = match_row_with_score
                    
                    if top_matches_dict:
                        item["OnRegion"] = top_matches_dict # Ini adalah dict
                        fuzzy_match_output[key].append(item)
                        total_fuzzy_match += 1
                    else:
                        item["OnRegion"] = None
                        no_match_output[key].append(item)
                        total_no_match += 1

                total_processed += 1
                progress.update(task, advance=1)

    console.print("\n--- [bold green]Hasil Pencocokan Selesai[/bold green] ---")
    console.print(f"Total Entri Diproses       : {total_processed:,}")
    console.print(f"Kecocokan 100% (Skor=100) : [green]{total_perfect_match:,}[/green] (akan disimpan di {JSON_OUTPUT_PERFECT})")
    console.print(f"Kecocokan Fuzzy (Skor<100): [yellow]{total_fuzzy_match:,}[/yellow] (akan disimpan di {JSON_OUTPUT_FUZZY})")
    console.print(f"Tidak Ada Kecocokan      : [dim]{total_no_match:,}[/dim] (akan disimpan di {JSON_OUTPUT_NONE})")
    
    return perfect_match_output, fuzzy_match_output, no_match_output

def save_single_result(output_path: Path, data: dict, file_label: str):
    """Menyimpan satu kamus data ke file JSON."""
    if not any(isinstance(v, list) and len(v) > 0 for v in data.values()):
        console.print(f"ℹ️ [dim]Tidak ada data untuk file '{file_label}', file tidak akan dibuat.[/dim]")
        return
        
    try:
        with output_path.open('w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        console.print(f"✅ [bold green]Hasil '{file_label}' berhasil disimpan ke '{output_path}'[/bold green]")
    except IOError as e:
        console.print(f"❌ [bold red]Gagal menyimpan file '{output_path}': {e}[/bold red]")
    except Exception as e:
        console.print(f"❌ [bold red]Terjadi error tak terduga saat menyimpan '{output_path}': {e}[/bold red]")

def main():
    console.print(f"🚀 [bold blue]Memulai Skrip Pencocokan Wilayah (Mode: 3 File Output)[/bold blue]")
    console.print(f"   [dim]JSON Input : {JSON_INPUT_FILE}[/dim]")
    console.print(f"   [dim]CSV Input  : {CSV_INPUT_FILE}[/dim]\n")
    
    # Memuat data CSV ke memori
    lookups = load_regions(CSV_INPUT_FILE)
    
    # Memproses file JSON dan membaginya menjadi tiga
    perfect_data, fuzzy_data, no_data = process_json_data(JSON_INPUT_FILE, lookups)
    
    # Menyimpan ketiga hasil secara terpisah
    console.print("\n--- [bold]Menyimpan Hasil[/bold] ---")
    save_single_result(JSON_OUTPUT_PERFECT, perfect_data, "Kecocokan 100%")
    save_single_result(JSON_OUTPUT_FUZZY, fuzzy_data, "Kecocokan Fuzzy")
    save_single_result(JSON_OUTPUT_NONE, no_data, "Tidak Ada Kecocokan")

if __name__ == "__main__":
    main()

