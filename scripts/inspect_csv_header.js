const fs = require('fs');
const readline = require('readline');

async function inspectCsv() {
  const fileStream = fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/backend/data/perfumes.csv');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    console.log("CSV Header:");
    console.log(line);
    break;
  }
}

inspectCsv();
