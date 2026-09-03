'use strict';
// Node's eingebautes fetch (undici) beachtet HTTPS_PROXY/HTTP_PROXY nicht
// automatisch (anders als curl). Diese Umgebung hier (device_bash-VM)
// erreicht das offene Internet nur ueber einen HTTP-CONNECT-Proxy (siehe
// env HTTPS_PROXY). Damit die ECHTE, unveraenderte lib/openai.js (die
// schlicht global fetch(...) aufruft) trotzdem funktioniert, ersetzen wir
// hier NUR global.fetch durch eine Implementierung, die exakt dieselbe
// Fetch-Response-Schnittstelle bereitstellt (status/ok/json()), aber
// intern ueber Node's https.Agent mit manuellem CONNECT-Tunnel geht --
// keine externe Abhaengigkeit noetig (kein npm-Registry-Zugriff noetig).
// Wird die Umgebungsvariable HTTPS_PROXY/https_proxy nicht gesetzt, bleibt
// das native fetch unangetastet.
const https = require('https');
const http = require('http');
const net = require('net');
const tls = require('tls');
const { URL } = require('url');

const PROXY_URL = process.env.HTTPS_PROXY || process.env.https_proxy || '';

if (PROXY_URL) {
  const proxy = new URL(PROXY_URL);
  const proxyAuth = proxy.username
    ? 'Basic ' + Buffer.from(decodeURIComponent(proxy.username) + ':' + decodeURIComponent(proxy.password || '')).toString('base64')
    : null;

  class TunnelAgent extends https.Agent {
    createConnection(options, callback) {
      const sock = net.connect(Number(proxy.port) || 80, proxy.hostname, () => {
        let req = `CONNECT ${options.host}:${options.port || 443} HTTP/1.1\r\n`;
        req += `Host: ${options.host}:${options.port || 443}\r\n`;
        if (proxyAuth) req += `Proxy-Authorization: ${proxyAuth}\r\n`;
        req += 'Proxy-Connection: Keep-Alive\r\n\r\n';
        sock.write(req);
      });
      let buf = Buffer.alloc(0);
      function onData(chunk) {
        buf = Buffer.concat([buf, chunk]);
        const headerEnd = buf.indexOf('\r\n\r\n');
        if (headerEnd === -1) return; // warten auf vollstaendige CONNECT-Antwort
        sock.removeListener('data', onData);
        const statusLine = buf.slice(0, buf.indexOf('\r\n')).toString('latin1');
        if (!/^HTTP\/1\.[01] 200/.test(statusLine)) {
          callback(new Error('Proxy CONNECT fehlgeschlagen: ' + statusLine));
          sock.destroy();
          return;
        }
        const tlsSocket = tls.connect({ socket: sock, servername: options.servername || options.host }, () => {
          callback(null, tlsSocket);
        });
        tlsSocket.on('error', callback);
      }
      sock.on('data', onData);
      sock.on('error', callback);
    }
  }

  const tunnelAgent = new TunnelAgent({ keepAlive: false });

  global.fetch = function proxyFetch(url, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const headers = Object.assign({}, opts.headers || {});
      const bodyBuf = opts.body ? Buffer.from(opts.body) : null;
      if (bodyBuf) headers['Content-Length'] = String(bodyBuf.length);
      const reqOpts = {
        method: opts.method || 'GET',
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers,
        agent: tunnelAgent,
      };
      const req = https.request(reqOpts, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const bodyText = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => JSON.parse(bodyText || '{}'),
            text: async () => bodyText,
          });
        });
      });
      req.on('error', reject);
      if (opts.signal) {
        opts.signal.addEventListener('abort', () => req.destroy(new Error('AbortError')));
      }
      if (bodyBuf) req.write(bodyBuf);
      req.end();
    });
  };
  process.stderr.write('[proxy_fetch_shim] aktiv (Proxy: ' + proxy.hostname + ':' + proxy.port + ')\n');
}
