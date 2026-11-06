import { fetchAuthenticated } from './authService';

/**
 * Mengirim pertanyaan ke Geo AI service.
 * @async
 * @param {string} question - Pertanyaan pengguna.
 * @returns {Promise<object>} Promise yang me-resolve ke objek jawaban AI.
 * @throws {Error} Jika permintaan gagal.
 */
export async function askGeoAi(question, sessionId) {
    if (!question) {
        throw new Error('Pertanyaan tidak boleh kosong.');
    }

    // --- MOCK DATA LOGIC START ---
    // Check specific mock triggers (STRICT MATCH ONLY)
    const normalizedQuestion = question.trim().toLowerCase();
    const isMock1 = normalizedQuestion === 'tes response 1';
    const isMock2 = normalizedQuestion === 'tes response 2';

    if (isMock1 || isMock2) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (isMock2) {
            return {
                "question": "tampilkan complaint di wilayah bekasi",
                "category": "intent_category_query",
                "category_scores": {
                    "intent_ticket_lookup": 0.47505892729085814,
                    "intent_customer_query": 0.5154789678873785,
                    "intent_category_query": 0.6056455681320798,
                    "SLA": 0.49189859058164725,
                    "Assignment_Team_Queries": 0.5377569594496054,
                    "Time_based_Queries": 0.46495864803316117,
                    "Channel_Queries": 0.5158314243085343,
                    "Complaint_Response_Content_Queries": 0.5758235569141853,
                    "Location_GIS_Queries": 0.4684691112589967,
                    "Summary_Aggregation_Questions": 0.5169886679337433,
                    "Mixed_Multi_Filter_Queries": 0.47037312957345684,
                    "General": 0.51359022334585
                },
                "answer": {
                    "analysis_summary": "Berdasarkan pertanyaan user untuk menampilkan complaint di wilayah Bekasi, dapat dilihat bahwa ada dua tiket yang terkait dengan komplainan pelanggan di kota Bekasi. Tiket 2512247187 dan 2512232380 memiliki alamat wilayah Kota Bekasi dan kondisi listrik yang tidak berfungsi.",
                    "data": [
                        {
                            "ticket_number": "2512247187",
                            "customer_name": "",
                            "province": "",
                            "city": "Bekasi",
                            "kabupaten": "",
                            "kelurahan": "Pondokgede",
                            "coordinates": "",
                            "coordinates_latitude": "-6.272564718",
                            "coordinates_longitude": "106.93447",
                            "Complaint": "tidak bisa login"
                        },
                        {
                            "ticket_number": "2512232380",
                            "customer_name": "",
                            "province": "",
                            "city": "Bekasi",
                            "kabupaten": "",
                            "kelurahan": "Pondokgede",
                            "coordinates": "",
                            "coordinates_latitude": "-6.272564718",
                            "coordinates_longitude": "106.93447",
                            "Complaint": "Gagal isi token listrik"
                        }
                    ],
                    "status": "success"
                }
            };
        }

        // Return Mock 1 (Complex/Multi data) for "tes response 1"
        return {
            "question": "tampilkan complaint di wilayah bekasi",
            "category": "intent_category_query",
            "category_scores": {
                "intent_ticket_lookup": 0.47505892729085814,
                "intent_customer_query": 0.5154789678873785,
                "intent_category_query": 0.6056455681320798,
                "SLA": 0.49189859058164725,
                "Assignment_Team_Queries": 0.5377569594496054,
                "Time_based_Queries": 0.46495864803316117,
                "Channel_Queries": 0.5158314243085343,
                "Complaint_Response_Content_Queries": 0.5758235569141853,
                "Location_GIS_Queries": 0.4684691112589967,
                "Summary_Aggregation_Questions": 0.5169886679337433,
                "Mixed_Multi_Filter_Queries": 0.47037312957345684,
                "General": 0.51359022334585
            },
            "answer": {
                "analysis_summary": "Keluhan pelanggan terkait layanan PLN atau Icon Plus hanya terjadi di Wilayah Bekasi, dengan beberapa kasus yang meliputi pemadaman listrik total dan wilayah pemadaman. Pelanggan juga mengeluh tentang meteran listrik rusak dan tidak berfungsi.",
                "data": [
                    {
                        "ticket_number": "{{2512247187}}",
                        "customer_name": "{{Jajang Deny Ardiansyah}}",
                        "province": "{{Jawa Barat}}",
                        "city": "{{Kota Bekasi}}",
                        "kabupaten": "{{Pondokgede}}",
                        "kelurahan": "{{Jatibening Baru}}",
                        "coordinates": "{{0101000020E6100000F645425BCEBB5A40F26997341B1719C0}}",
                        "coordinates_latitude": "{{-6.272564718}}",
                        "coordinates_longitude": "{{106.93447}}",
                        "Complaint": "{{Technical Issue|Kendala teknis pada aplikasi PLN Mobile|1-METER-ISSUE}}"
                    },
                    {
                        "ticket_number": "{{2512232380}}",
                        "customer_name": "{{Jajang Deny Ardiansyah}}",
                        "province": "{{Jawa Barat}}",
                        "city": "{{Kota Bekasi}}",
                        "kabupaten": "{{Pondokgede}}",
                        "kelurahan": "{{Jatibening Baru}}",
                        "coordinates": "{{0101000020E6100000F645425BCEBB5A40F26997341B1719C0}}",
                        "coordinates_latitude": "{{-6.272564718}}",
                        "coordinates_longitude": "{{106.93447}}",
                        "Complaint": "{{Complaint|Keluhan pelanggan terkait layanan PLN atau Icon Plus|1-POWER-OUTAGE}}"
                    },
                    {
                        "ticket_number": "{{2512239830}}",
                        "customer_name": "{{Jajang Deny Ardiansyah}}",
                        "province": "{{Jawa Barat}}",
                        "city": "{{Kota Bekasi}}",
                        "kabupaten": "{{Pondokgede}}",
                        "kelurahan": "{{Jatibening Baru}}",
                        "coordinates": "{{0101000020E6100000F645425BCEBB5A40F26997341B1719C0}}",
                        "coordinates_latitude": "{{-6.272564718}}",
                        "coordinates_longitude": "{{106.93447}}",
                        "Complaint": "{{Request|Permintaan layanan baru atau perubahan layanan|2-POWER-CHANGE}}"
                    },
                    {
                        "ticket_number": "{{2512235437}}",
                        "customer_name": "{{Salman Handoko}}",
                        "province": "{{DKI Jakarta}}",
                        "city": "{{Kota Adm. Jakarta Pusat}}",
                        "kabupaten": "{{Sawah Besar||Mangga Dua Selatan|}}",
                        "kelurahan": "{{-6.140813897|106.826566427|}}",
                        "coordinates": "{{1004||}}",
                        "coordinates_latitude": "{{-6.140813897}}",
                        "coordinates_longitude": "{{106.826566427|}}",
                        "Complaint": "{{Complaint|Keluhan pelanggan terkait layanan PLN atau Icon Plus|1-POWER-OUTAGE}}"
                    }
                ],
                "status": "success"
            }
        };
    }
    // --- MOCK DATA LOGIC END ---

    // Fetch real data (no automatic fallback)
    const response = await fetchAuthenticated('/ai/ask', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: {
            question,
            session_id: sessionId
        },
    });

    if (!response.ok) {
        throw new Error(`Gagal menghubungi AI Service: ${response.status}`);
    }

    const data = await response.json();
    return data;
}

/**
 * Mengirim feedback untuk response Geo AI.
 * @async
 * @param {string|number} rating - "1" untuk thumbs-up, "-1" untuk thumbs-down.
 * @param {string} comment - Komentar opsional.
 * @param {string} requestId - ID request dari pesan AI.
 * @returns {Promise<object>}
 */
export async function sendGeoAiFeedback(rating, comment, requestId) {
    const response = await fetchAuthenticated('/ai/feedback', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: {
            rating: String(rating),
            comment: comment || "",
            request_id: requestId
        },
    });

    if (!response.ok) {
        throw new Error(`Gagal mengirim feedback: ${response.status}`);
    }

    const data = await response.json();
    return data;
}
