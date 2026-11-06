import React from 'react';
import TabButton from '../TabButton';
import CustomSelectDropdown from '../CustomSelectDropdown';

const SidebarAdmin = ({
    isMobile,
    activeAdminTab,
    setActiveAdminTab,
    currentSelection,
    onSelectionChange,
    provinceOptions,
    kabkotaOptions,
    kecamatanOptions,
    desaOptions,
    loadingStates = {}
}) => {
    const { provinsi: provinsiLoading, kabkota: kabkotaLoading, kecamatan: kecamatanLoading, desa: desaLoading } = loadingStates;

    const handleProvinceChange = (e) => {
        const provinceCode = e.target.value;
        onSelectionChange({ provinceCode: provinceCode || undefined }, 'province');
    };

    const handleKabkotaChange = (e) => {
        const kabkotaCode = e.target.value;
        onSelectionChange({
            provinceCode: currentSelection.provinceCode,
            provinceName: currentSelection.provinceName,
            kabkotaCode: kabkotaCode || undefined,
        }, 'kabkota');
    };

    const handleKecamatanChange = (e) => {
        const kecamatanCode = e.target.value;
        onSelectionChange({
            provinceCode: currentSelection.provinceCode,
            provinceName: currentSelection.provinceName,
            kabkotaCode: currentSelection.kabkotaCode,
            kabkotaName: currentSelection.kabkotaName,
            kecamatanCode: kecamatanCode || undefined,
        }, 'kecamatan');
    };

    const handleDesaChange = (e) => {
        const desaName = e.target.value;
        onSelectionChange({ ...currentSelection, desaName: desaName || undefined }, 'desa');
    };

    return (
        <>
            <div className={`${isMobile ? 'pt-4' : 'pt-20'} flex-shrink-0`}>
                <div className="border-b border-gray-200">
                    <div className="flex">
                        <TabButton text="Administrasi Lokal" isActive={activeAdminTab === 'admin'} onClick={() => setActiveAdminTab('admin')} />
                        {/* <TabButton text="Nomor Telepon" isActive={activeAdminTab === 'phone'} onClick={() => setActiveAdminTab('phone')} /> */}
                    </div>
                </div>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                {activeAdminTab === 'admin' && (
                    <div className="flex flex-col gap-4">
                        <CustomSelectDropdown label="1. Provinsi" value={currentSelection.provinceCode} onChange={handleProvinceChange} options={provinceOptions} placeholder={provinsiLoading ? "Memuat..." : "-- Pilih Provinsi --"} disabled={provinsiLoading} />
                        <CustomSelectDropdown label="2. Kabupaten/Kota" value={currentSelection.kabkotaCode} onChange={handleKabkotaChange} options={kabkotaOptions} placeholder={kabkotaLoading ? "Memuat..." : "-- Pilih Kab/Kota --"} disabled={!currentSelection.provinceCode || kabkotaLoading} />
                        <CustomSelectDropdown label="3. Kecamatan" value={currentSelection.kecamatanCode} onChange={handleKecamatanChange} options={kecamatanOptions} placeholder={kecamatanLoading ? "Memuat..." : "-- Pilih Kecamatan --"} disabled={!currentSelection.kabkotaCode || kecamatanLoading} />
                        <CustomSelectDropdown label="4. Desa/Kelurahan" value={currentSelection.desaName} onChange={handleDesaChange} options={desaOptions} placeholder={desaLoading ? "Memuat..." : "-- Pilih Desa/Kelurahan --"} disabled={!currentSelection.kecamatanCode || desaLoading} />
                    </div>
                )}
                {activeAdminTab === 'phone' && (
                    <div className="p-4 text-center text-gray-500">
                        <p>Fitur nomor telepon sedang dalam pengembangan.</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default SidebarAdmin;
