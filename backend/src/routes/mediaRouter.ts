import { Router, Request, Response } from 'express';
import https from 'https';
import http from 'http';
import { URL } from 'url';

export const mediaRouter = Router();

const ALLOWED_HOST_SUFFIXES = [
  'licdn.com',
  'linkedin.com',
  'cdninstagram.com',
  'fbcdn.net',
  'googleusercontent.com',
  'ytimg.com',
  'twimg.com'
];

function isHostAllowed(hostname: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some(suffix => hostname === suffix || hostname.endsWith('.' + suffix));
}

mediaRouter.get('/proxy', (req: Request, res: Response) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only HTTP and HTTPS protocols allowed' });
  }

  if (!isHostAllowed(parsedUrl.hostname)) {
    return res.status(403).json({ error: 'Domain not allowed for proxying' });
  }

  const clientRange = req.headers['range'];
  const requestHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
    'Sec-Fetch-Dest': 'video',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site'
  };

  if (clientRange) {
    requestHeaders['Range'] = clientRange;
  }

  const protocol = parsedUrl.protocol === 'https:' ? https : http;

  const proxyReq = protocol.get(
    parsedUrl.toString(),
    {
      headers: requestHeaders,
      timeout: 15000
    },
    (targetRes) => {
      const statusCode = targetRes.statusCode || 200;

      if ((statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) && targetRes.headers.location) {
        try {
          const redirectUrl = new URL(targetRes.headers.location, parsedUrl.origin);
          if (isHostAllowed(redirectUrl.hostname)) {
            return protocol.get(redirectUrl.toString(), { headers: requestHeaders }, (redirectRes) => {
              forwardResponse(redirectRes, res);
            }).on('error', (err) => {
              console.error('[MediaProxy] Redirect error:', err.message);
              if (!res.headersSent) res.status(502).json({ error: 'Proxy redirect failed' });
            });
          }
        } catch (e) {}
      }

      forwardResponse(targetRes, res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error('[MediaProxy] Fetch error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to fetch upstream media' });
    }
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: 'Media proxy request timed out' });
    }
  });

  req.on('close', () => {
    proxyReq.destroy();
  });
});

function forwardResponse(targetRes: http.IncomingMessage, clientRes: Response) {
  const statusCode = targetRes.statusCode || 200;
  
  const headersToForward = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'last-modified',
    'etag'
  ];

  headersToForward.forEach((h) => {
    const val = targetRes.headers[h];
    if (val) {
      clientRes.setHeader(h, val);
    }
  });

  clientRes.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  clientRes.setHeader('Access-Control-Allow-Origin', '*');

  clientRes.status(statusCode);
  targetRes.pipe(clientRes);
}
