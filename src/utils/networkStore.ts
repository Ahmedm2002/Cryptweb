export const emailToSocketMap: Map<string, { socketId: string; name: string }> =
  new Map();

export const activePeers: Map<string, string> = new Map();

export const ipToUsersMap: Map<string, Set<string>> = new Map();

export function normalizeIP(ip: string): string {
  ip = ip.replace(/^\[(.+)\]$/, "$1");
  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }
  if (ip === "::1") {
    return "127.0.0.1";
  }
  return ip.toLowerCase();
}
