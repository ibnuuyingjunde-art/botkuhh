import axios from "axios";

/**
 * npmsearch.js
 * Scraper pencarian package NPM lewat NPM Registry resmi (registry.npmjs.org),
 * bukan API pihak ketiga — jadi nggak gantung uptime server orang lain.
 */

const client = axios.create({
  baseURL: "https://registry.npmjs.org",
  timeout: 15000,
});

/**
 * Cari package di NPM Registry.
 * @param {string} query - kata kunci pencarian
 * @param {number} size - jumlah hasil maksimal (default 10, max 250 sesuai limit registry)
 * @returns {Promise<{status:boolean, keyword?:string, total?:number, responseTime?:string, result?:object[], mess?:string}>}
 */
async function npmsearch(query, size = 10) {
  if (!query || !String(query).trim()) {
    return { status: false, mess: "Kata kunci pencarian tidak boleh kosong." };
  }

  const started = Date.now();

  try {
    const { data } = await client.get("/-/v1/search", {
      params: { text: query, size },
    });

    if (!data?.objects?.length) {
      return { status: false, mess: "Tidak ada package ditemukan." };
    }

    const result = data.objects.map((o) => ({
      package: o.package?.name,
      version: o.package?.version,
      description: o.package?.description || "",
      keywords: o.package?.keywords || [],
      publishedAt: o.package?.date,
      publisher: o.package?.publisher?.username || "-",
      score: {
        final: o.score?.final ?? 0,
        quality: o.score?.detail?.quality ?? 0,
        popularity: o.score?.detail?.popularity ?? 0,
        maintenance: o.score?.detail?.maintenance ?? 0,
      },
      links: {
        npm: o.package?.links?.npm,
        homepage: o.package?.links?.homepage,
        repository: o.package?.links?.repository,
        bugs: o.package?.links?.bugs,
      },
    }));

    return {
      status: true,
      keyword: query,
      total: data.total,
      responseTime: `${Date.now() - started}ms`,
      result,
    };
  } catch (err) {
    const remote = err?.response?.data?.error || err?.response?.data?.message;
    return {
      status: false,
      mess: remote || err.message || "Gagal mengambil data dari NPM Registry.",
    };
  }
}

/**
 * Ambil detail satu package spesifik langsung by name (bukan search).
 * @param {string} name - nama package persis
 */
async function npmPackageInfo(name) {
  if (!name || !String(name).trim()) {
    return { status: false, mess: "Nama package tidak boleh kosong." };
  }

  try {
    const { data } = await client.get(`/${encodeURIComponent(name)}`);
    const latest = data?.["dist-tags"]?.latest;
    const version = data?.versions?.[latest] || {};

    return {
      status: true,
      package: data.name,
      version: latest,
      description: data.description || version.description || "",
      license: version.license || data.license || "-",
      author: version.author?.name || data.author?.name || "-",
      publishedAt: data.time?.[latest],
      maintainers: (data.maintainers || []).map((mm) => mm.name),
      tarball: version.dist?.tarball,
      unpackedSize: version.dist?.unpackedSize,
      links: {
        npm: `https://www.npmjs.com/package/${data.name}`,
        homepage: version.homepage,
        repository: version.repository?.url,
        bugs: version.bugs?.url,
      },
    };
  } catch (err) {
    if (err?.response?.status === 404) {
      return { status: false, mess: `Package "${name}" tidak ditemukan.` };
    }
    return {
      status: false,
      mess: err?.response?.data?.error || err.message || "Gagal mengambil detail package.",
    };
  }
}

export { npmsearch, npmPackageInfo };
export default npmsearch;