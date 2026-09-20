import { networkInterfaces } from 'node:os';

export function lanAddresses(port, host = '0.0.0.0', interfaces = networkInterfaces()) {
  if (['127.0.0.1', 'localhost', '::1'].includes(host)) return [];
  const addresses = Object.values(interfaces).flat().filter(Boolean)
    .filter(entry => entry.family === 'IPv4' && !entry.internal)
    .map(entry => entry.address)
    .filter(address => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address));
  return [...new Set(addresses)].map(address => `http://${address}:${port}`);
}

export function connectionInfo(req, port, host, interfaces) {
  const urls = lanAddresses(port, host, interfaces);
  const connectedAddress = req.socket.localAddress?.replace(/^::ffff:/, '');
  urls.sort((a, b) => Number(new URL(b).hostname === connectedAddress) - Number(new URL(a).hostname === connectedAddress));
  return { available: true, lan_enabled: !['127.0.0.1', 'localhost', '::1'].includes(host), join_urls: urls };
}
