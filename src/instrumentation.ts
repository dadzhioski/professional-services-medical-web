// Validate runtime inputs before a standalone server can serve requests.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getServerEnvironment } = await import("./lib/config/server");
    getServerEnvironment();
  }
}
