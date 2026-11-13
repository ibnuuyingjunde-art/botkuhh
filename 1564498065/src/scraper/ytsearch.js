import axios from "axios";

const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const INNERTUBE_CONTEXT = {
  client: {
    clientName: "WEB",
    clientVersion: "2.20240101.00.00",
    hl: "en",
    gl: "US",
  },
};

function extractVideos(data) {
  const videos = [];
  const sections =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents || [];

  for (const section of sections) {
    const items = section?.itemSectionRenderer?.contents || [];
    for (const item of items) {
      const vr = item.videoRenderer;
      if (!vr || !vr.videoId) continue;

      const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || "";
      const duration = vr.lengthText?.simpleText || "LIVE";
      const author =
        vr.ownerText?.runs?.[0]?.text ||
        vr.longBylineText?.runs?.[0]?.text ||
        "";

      videos.push({
        videoId: vr.videoId,
        title,
        url: `https://www.youtube.com/watch?v=${vr.videoId}`,
        duration: { timestamp: duration },
        author: { name: author },
        thumbnail: `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
      });
    }
  }
  return videos;
}

export default async function ytsearch(query) {
  const { data } = await axios.post(
    `https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_KEY}`,
    {
      context: INNERTUBE_CONTEXT,
      query,
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    }
  );

  return { videos: extractVideos(data) };
}