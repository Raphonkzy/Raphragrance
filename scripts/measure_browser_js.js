const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  let totalJsBytesTransferred = 0;
  const jsRequests = [];

  page.on("response", async (response) => {
    const url = response.url();
    const headers = response.headers();
    const contentType = headers["content-type"] || "";
    if (url.endsWith(".js") || contentType.includes("javascript")) {
      const buffer = await response.body().catch(() => null);
      if (buffer) {
        // Look at headers content-length or buffer length
        const size = buffer.length;
        jsRequests.push({ url: url.split("/").pop(), size, headers: response.headers() });
        totalJsBytesTransferred += size;
      }
    }
  });

  await page.goto("http://localhost:3001/", { waitUntil: "networkidle" });

  console.log("=== Actual JS transferred to Chromium on / ===");
  for (const req of jsRequests) {
    console.log(`  ${req.url}: ${(req.size / 1024).toFixed(1)} KB`);
  }
  console.log(
    `\nTotal JS downloaded by modern browser: ${(totalJsBytesTransferred / 1024).toFixed(1)} KB`
  );

  await browser.close();
})();
