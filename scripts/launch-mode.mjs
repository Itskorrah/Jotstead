/** Direct workspace access is only for the local computer, never a remote deployment. */
export function launchMode(env, args = []) {
  const host = env.JOTSTEAD_BIND_HOST || "127.0.0.1";
  const loopback = ["127.0.0.1", "localhost", "::1"].includes(host);
  let remoteOrigin = false;
  if (env.JOTSTEAD_PUBLIC_URL) {
    const origin = new URL(env.JOTSTEAD_PUBLIC_URL);
    remoteOrigin = !["127.0.0.1", "localhost", "[::1]"].includes(
      origin.hostname,
    );
  }
  const local =
    loopback &&
    !remoteOrigin &&
    !env.JOTSTEAD_PASSWORD &&
    !args.includes("--protected") &&
    (env.JOTSTEAD_LOCAL_ONLY !== "0" || args.includes("--local"));
  return { host, local: local ? "1" : "0" };
}
