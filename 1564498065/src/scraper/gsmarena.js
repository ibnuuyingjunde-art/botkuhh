// gsmarena-api dimuat saat pertama dipakai, bukan saat bot start
const getGsmarena = async () => (await import("gsmarena-api")).default;

async function search(query) {
  return (await getGsmarena()).search.search(query);
}

async function detail(deviceId) {
  return (await getGsmarena()).catalog.getDevice(deviceId);
}

async function brands() {
  return (await getGsmarena()).catalog.getBrands();
}

async function brandDevices(brandId) {
  return (await getGsmarena()).catalog.getBrand(brandId);
}

export { search, detail, brands, brandDevices };
