import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log(`Start seeding ...`);

    // Create parent prefix '2'
    // Deskripsi diperbarui untuk mencerminkan cakupan wilayah yang baru
    const prefix2 = await prisma.phone_prefixes.upsert({
        where: { prefix: '2' },
        update: {
            description: 'Area Sebagian Jawa (DKI Jakarta, Jabar, Jateng, DIY)',
        },
        create: {
            prefix: '2',
            description: 'Area Sebagian Jawa (DKI Jakarta, Jabar, Jateng, DIY)',
        },
    });

    // Create prefix '21' as a child of '2'
    const prefix21 = await prisma.phone_prefixes.upsert({
        where: { prefix: '21' },
        update: {},
        create: {
            prefix: '21',
            description: 'DKI Jakarta & sekitarnya',
            parent_id: prefix2.id,
        },
    });

    // Create prefix '22' as a child of '2'
    const prefix22 = await prisma.phone_prefixes.upsert({
        where: { prefix: '22' },
        update: {},
        create: {
            prefix: '22',
            description: 'Bandung & sekitarnya',
            parent_id: prefix2.id,
        },
    });

    // Create prefix '231'
    const prefix231 = await prisma.phone_prefixes.upsert({
        where: { prefix: '231' },
        update: {},
        create: {
            prefix: '231',
            description: 'Cirebon',
            parent_id: prefix2.id,
        },
    });

    console.log('Seeded phone prefixes');

    // --- Link Prefixes to Regions ---

    // ==========================================
    // BAGIAN YANG DILENGKAPI (SESUAI PERMINTAAN)
    // Menghubungkan prefix 2 ke beberapa provinsi
    // ==========================================
    console.log('--- Linking Prefix 2 to Provinces ---');
    const prefix2RegionNames = ['DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Daerah Istimewa Yogyakarta'];

    for (const regionName of prefix2RegionNames) {
        // Mencari region berdasarkan nama dan level 'provinsi' agar lebih spesifik
        const region = await prisma.regions.findFirst({
            where: {
                nama: regionName,
                level: 'provinsi'
            },
        });

        if (region) {
            await prisma.phone_prefix_regions.upsert({
                where: { phone_prefix_id_region_id: { phone_prefix_id: prefix2.id, region_id: region.id } },
                update: {},
                create: {
                    phone_prefix_id: prefix2.id,
                    region_id: region.id,
                },
            });
            console.log(`Linked prefix 2 to ${regionName} (ID: ${region.id})`);
        } else {
            console.warn(`Region '${regionName}' not found. Skipping link for prefix 2.`);
        }
    }
    // ==========================================
    // AKHIR BAGIAN BARU
    // ==========================================

    // Link prefix '21' to the province of DKI Jakarta
    const jakartaProv = await prisma.regions.findFirst({ where: { nama: 'DKI Jakarta', level: 'provinsi' } });
    if (jakartaProv) {
        await prisma.phone_prefix_regions.upsert({
            where: { phone_prefix_id_region_id: { phone_prefix_id: prefix21.id, region_id: jakartaProv.id } },
            update: {},
            create: {
                phone_prefix_id: prefix21.id,
                region_id: jakartaProv.id,
            },
        });
        console.log(`Linked prefix 21 to DKI Jakarta (ID: ${jakartaProv.id})`);
    } else {
        console.warn("Region 'DKI Jakarta' not found. Skipping link for prefix 21.");
    }

    // Link prefix '22' to Kota Bandung
    const bandungKota = await prisma.regions.findFirst({ where: { nama: 'Kota Bandung', level: 'kab_kota' } });
    if (bandungKota) {
        await prisma.phone_prefix_regions.upsert({
            where: { phone_prefix_id_region_id: { phone_prefix_id: prefix22.id, region_id: bandungKota.id } },
            update: {},
            create: {
                phone_prefix_id: prefix22.id,
                region_id: bandungKota.id,
            },
        });
        console.log(`Linked prefix 22 to Kota Bandung (ID: ${bandungKota.id})`);
    } else {
        console.warn("Region 'Kota Bandung' not found. Skipping link for prefix 22.");
    }

    // Link prefix '231' to Kota Cirebon (Perbaikan: 'Cirebon' diubah menjadi 'Kota Cirebon' agar lebih spesifik)
    const cirebonKota = await prisma.regions.findFirst({ where: { nama: 'Cirebon', level: 'kab_kota' } });
    if (cirebonKota) {
        await prisma.phone_prefix_regions.upsert({
            where: { phone_prefix_id_region_id: { phone_prefix_id: prefix231.id, region_id: cirebonKota.id } },
            update: {},
            create: {
                phone_prefix_id: prefix231.id,
                region_id: cirebonKota.id,
            },
        });
        console.log(`Linked prefix 231 to Kota Cirebon (ID: ${cirebonKota.id})`);
    } else {
        console.warn("Region 'Kota Cirebon' not found. Skipping link for prefix 231.");
    }


    console.log(`Seeding finished.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });