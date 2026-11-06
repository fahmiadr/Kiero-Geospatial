import pandas as pd
import json
import sys

# Coba impor library yang diperlukan untuk file Excel
try:
    import openpyxl
except ImportError:
    print("Error: Library 'openpyxl' tidak ditemukan.")
    print("Silakan install terlebih dahulu dengan perintah:")
    print("pip install openpyxl")
    sys.exit(1) # Keluar dari skrip jika library tidak ada

# --- FUNGSI HELPER BARU ---
def sort_tree_recursively(node):
    """
    Mengurutkan kunci 'children' dari node secara rekursif (A-Z).
    Fungsi ini dipanggil sebelum menyimpan ke JSON.
    """
    # Cek apakah 'children' ada dan bukan kamus kosong
    if "children" in node and node["children"]:
        # 1. Dapatkan kunci anak-anak (prefixes) dan urutkan A-Z
        sorted_child_keys = sorted(node["children"].keys())
        
        # 2. Buat kamus children baru yang terurut
        new_sorted_children = {}
        for key in sorted_child_keys:
            # 3. Panggil rekursif untuk setiap anak
            # dan simpan hasilnya di kamus baru
            new_sorted_children[key] = sort_tree_recursively(node["children"][key])
        
        # 4. Ganti 'children' yang lama dengan yang baru
        node["children"] = new_sorted_children
    
    # Kembalikan node yang sudah dimodifikasi
    return node
# -------------------------


# --- FUNGSI UNTUK MEMPROSES DAN MEMBUAT POHON (TREE) ---
def build_prefix_tree(df_full, call_type, output_filename):
    """
    Memfilter DataFrame berdasarkan call_type, membangun pohon prefix,
    dan menyimpannya ke file JSON yang diurutkan.
    """
    
    print(f"\n--- Memulai proses untuk CallType: {call_type} ---")
    
    # 1. Filter DataFrame HANYA untuk call_type yang spesifik
    df_filtered = df_full[df_full['CallType'] == call_type].copy()
    
    if df_filtered.empty:
        print(f"Tidak ada data ditemukan untuk CallType: {call_type}. Melewatkan...")
        return

    # 2. Bersihkan data
    df_filtered['PrefixDesc'] = df_filtered['PrefixDesc'].fillna('N/A')
    df_filtered['PrefixDesc'] = df_filtered['PrefixDesc'].replace('NULL', 'N/A')
    
    # Ubah ke string dan bersihkan jika ada '.0' di akhir
    df_filtered['PrefixNo'] = df_filtered['PrefixNo'].astype(str)
    df_filtered['PrefixNo'] = df_filtered['PrefixNo'].str.replace(r'\.0$', '', regex=True)

    print(f"Total prefix ditemukan: {len(df_filtered)}")
    
    # 3. Buat kamus (dictionary) untuk semua node prefix
    nodes = {}
    for _, row in df_filtered.iterrows():
        prefix_str = row['PrefixNo']
        if prefix_str not in nodes:
            # --- PERUBAHAN URUTAN DI SINI ---
            # Pastikan 'details' didefinisikan SEBELUM 'children'
            # Python 3.7+ akan mengingat urutan ini.
            nodes[prefix_str] = {
                "details": {"PrefixDesc": row['PrefixDesc'], "CallType": row['CallType']},
                "children": {} 
            }
            
    # 4. Urutkan semua prefix berdasarkan panjangnya (terpanjang ke terpendek)
    sorted_prefixes = sorted(list(nodes.keys()), key=len, reverse=True)
    
    # 5. Bangun hierarki pohon (trie)
    root_nodes = nodes.copy()
    
    for prefix in sorted_prefixes:
        if prefix not in root_nodes:
            continue
        node = root_nodes[prefix]
        
        for i in range(len(prefix) - 1, 0, -1):
            parent_prefix = prefix[:i]
            if parent_prefix in nodes:
                nodes[parent_prefix]['children'][prefix] = node
                if prefix in root_nodes:
                    del root_nodes[prefix]
                break 
                
    # 6. 'final_trie' berisi node-node akar
    final_trie = root_nodes
    
    # --- PERUBAHAN DI SINI ---
    # 7. Urutkan seluruh pohon secara rekursif (Prefixes A-Z)
    print("Mengurutkan pohon secara rekursif (A-Z)...")
    
    # 7a. Urutkan level root (induk teratas)
    sorted_root_keys = sorted(final_trie.keys())
    
    final_sorted_trie = {}
    for root_key in sorted_root_keys:
        # 7b. Panggil fungsi rekursif untuk mengurutkan children di setiap root node
        final_sorted_trie[root_key] = sort_tree_recursively(final_trie[root_key])
        
    # 8. Simpan hasil pemetaan ke file JSON
    with open(output_filename, 'w', encoding='utf-8') as f:
        # HAPUS 'sort_keys=True'
        # Ini akan memaksa json.dump untuk menghormati urutan
        # 'details' lalu 'children' yang kita tentukan di langkah #3.
        json.dump(final_sorted_trie, f, indent=4)
    # -------------------------
        
    print(f"Total node akar ditemukan: {len(final_sorted_trie)}")
    print(f"Hasil {call_type} disimpan (DIURUTKAN A-Z) ke: {output_filename}")

# --- SKRIP UTAMA ---
def main():
    # --- GANTI NAMA FILE INI ---
    file_name = '../../../Data Aset/tPrefix.xlsx' 
    # -------------------------
    
    # Ganti path output jika perlu
    output_path_lokal = '../../../Data Aset/prefix_mapping_LOKAL.json'
    output_path_sljj = '../../../Data Aset/prefix_mapping_SLJJ.json'

    try:
        df_main = pd.read_excel(file_name, sheet_name='Sheet1')
        
        # Bersihkan (trim) spasi tersembunyi dari kolom 'CallType'
        if 'CallType' in df_main.columns:
            df_main['CallType'] = df_main['CallType'].astype(str).str.strip()
        else:
            print(f"Error: Kolom 'CallType' tidak ditemukan di file {file_name}")
            return
        
        # 1. Proses untuk LOKAL
        build_prefix_tree(df_main, 'LOKAL', output_path_lokal)
        
        # 2. Proses untuk SLJJ
        build_prefix_tree(df_main, 'SLJJ', output_path_sljj)
        
        print("\n--- Semua proses selesai. ---")

    except FileNotFoundError:
        print(f"Error: File tidak ditemukan di {file_name}")
    except Exception as e:
        print(f"Terjadi error: {e}")

# Menjalankan skrip utama
if __name__ == "__main__":
    main()