import axios from 'axios';
import { JSDOM } from 'jsdom';

async function getYouTubeMetadata(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const dom = new JSDOM(response.data);
        const scripts = dom.window.document.querySelectorAll('script');
        let title = 'Unknown';
        let description = 'Unknown';
        for (const script of scripts) {
            if (script.textContent.includes('ytInitialData')) {
                const jsonStr = script.textContent.split('var ytInitialData = ')[1]?.split(';')[0];
                if (jsonStr) {
                    try {
                        const data = JSON.parse(jsonStr);
                        // Deep dive into the nested structure to find title and description
                        const videoDetails = data.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer;
                        const secondaryInfo = data.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[1]?.videoSecondaryInfoRenderer;
                        
                        title = videoDetails?.title?.runs?.[0]?.text || dom.window.document.querySelector('title').textContent;
                        description = secondaryInfo?.attributedDescription?.content || secondaryInfo?.description?.runs?.map(r => r.text).join('') || 'No description';
                    } catch (e) {}
                }
            }
        }
        return { url, title, description };
    } catch (error) {
        return { url, title: 'Error', description: error.message };
    }
}

const urls = [
    'https://www.youtube.com/watch?v=7gmfix8s8Dc',
    'https://www.youtube.com/watch?v=GnPGJHHVMlo',
    'https://www.youtube.com/watch?v=3qWPjtS_bOo',
    'https://www.youtube.com/watch?v=UQAP26WkhQo&t=309s',
    'https://www.youtube.com/watch?v=LfhJp_sjdPk',
    'https://www.youtube.com/watch?v=t3yqMVNaz0o',
    'https://www.youtube.com/watch?v=cQtzU_w-Q0o',
    'https://www.youtube.com/watch?v=UKNhpQqcg-Q',
    'https://www.youtube.com/watch?v=ukeTNlKy3YY',
    'https://www.youtube.com/watch?v=x8mtzXGe_RE',
    'https://www.youtube.com/watch?v=vgnGh2loJFA',
    'https://www.youtube.com/watch?v=J25-FYC9Aoc',
    'https://www.youtube.com/watch?v=mrWPb0EAeq4'
];

async function run() {
    const results = [];
    for (const url of urls) {
        const metadata = await getYouTubeMetadata(url);
        results.push(metadata);
    }
    console.log(JSON.stringify(results, null, 2));
}

run();
