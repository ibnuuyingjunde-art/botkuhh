import axios from 'axios'
import crypto from 'crypto'
import qs from 'qs'
const CONFIG = {
    BASE_URL: "https://ssyoutube.com",
    API: {
        CONVERT: "/api/convert"
    },
    SECRETS: {
        SALT: "384d5028ee4a399f6cae0175025a1708aa924fc0ccb08be1aa359cd856dd1639",
        FIXED_TS: "1765962059039"
    },
    HEADERS: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Origin": "https://ssyoutube.com",
        "Referer": "https://ssyoutube.com/"
    }
};

const cryptoUtils = () => {
    return {
        generateSignature: (url, timestamp) => {
            try {
                const rawString = url + timestamp + CONFIG.SECRETS.SALT;
                return crypto.createHash('sha256').update(rawString).digest('hex');
            } catch (e) {
                console.error("Error generating signature:", e);
                return null;
            }
        }
    };
};

const utils = cryptoUtils();

const formatSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};

const ssyoutube = {
    download: async (videoUrl) => {
        try {
            if (!videoUrl || !videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
                return { error: 'URL tidak valid. Harap gunakan URL YouTube.' };
            }

            const currentTs = Date.now().toString();
            const signature = utils.generateSignature(videoUrl, currentTs);

            if (!signature) return { error: 'Gagal membuat signature keamanan.' };

            const payload = {
                'sf_url': videoUrl,
                'ts': currentTs,
                '_ts': CONFIG.SECRETS.FIXED_TS,
                '_tsc': '0',
                '_s': signature
            };

            const response = await axios.post(
                CONFIG.BASE_URL + CONFIG.API.CONVERT,
                qs.stringify(payload), 
                { headers: CONFIG.HEADERS }
            );

            const data = response.data;

            if (!data || !data.url) {
                return { error: 'Gagal mengambil data. Server mungkin memblokir request.' };
            }

            const result = {
                meta: {
                    id: data.id,
                    title: data.meta?.title,
                    duration: data.meta?.duration,
                    thumbnail: data.thumb
                },
                downloads: []
            };

            if (Array.isArray(data.url)) {
                result.downloads = data.url
                    .filter(item => !item.no_audio)
                    .map(item => ({
                        quality: item.quality || item.subname,
                        format: item.ext,
                        size: formatSize(item.filesize),
                        url: item.url,
                        audio: item.audio
                    }));
            }

            return result;

        } catch (error) {
            console.error(`error download: ${error.message}`);
            if (error.response) console.error("Server Response:", error.response.data);
            return { error: error.message };
        }
    }
};

export default ssyoutube

