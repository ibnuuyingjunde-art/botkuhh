import { Tools } from 'abot-scraper';

const tools = new Tools();

/**
 * Scraper Remini (Image Enhancer) - via package abot-scraper
 * Tidak butuh upload ke host luar, buffer diproses langsung.
 * @param {Buffer} imageBuffer - Buffer dari gambar yang ingin di-HD-kan
 * @returns {Promise<Buffer>} - Buffer gambar hasil HD
 */
export async function remini2(imageBuffer) {
  let result;

  // Coba Remini V2 dulu, fallback ke V1 kalau gagal
  try {
    result = await tools.reminiV2(imageBuffer);
    console.log('[Remini2] Hasil reminiV2:', JSON.stringify(result));
  } catch (err) {
    console.error('[Remini2] reminiV2 gagal, coba reminiV1:', err.message);
    try {
      result = await tools.reminiV1(imageBuffer);
      console.log('[Remini2] Hasil reminiV1:', JSON.stringify(result));
    } catch (err2) {
      console.error('[Remini2] reminiV1 juga gagal:', err2.message);
      throw new Error('Gagal memproses gambar (V1 & V2 sama-sama gagal).');
    }
  }

  // Hasil dari abot-scraper bisa berupa Buffer langsung, atau objek berisi url/base64.
  // Kita handle beberapa kemungkinan bentuk hasil di sini:
  if (Buffer.isBuffer(result)) {
    return result;
  }

  if (result?.data && Buffer.isBuffer(result.data)) {
    return result.data;
  }

  const resultUrl =
    result?.result?.image_url ||
    result?.url ||
    result?.image_data ||
    result?.link;

  if (resultUrl && typeof resultUrl === 'string') {
    const axios = (await import('axios')).default;
    const { data } = await axios.get(resultUrl, { responseType: 'arraybuffer' });
    return Buffer.from(data);
  }

  throw new Error(`Format hasil tidak dikenali. Respons: ${JSON.stringify(result)}`);
}