const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const Redis = require("ioredis");

const publisher = new Redis("");

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
});

const project_id = process.env.PROJECT_ID;

function publishLog(log) {
  publisher.publish(`logs:${project_id}`, JSON.stringify({ log }));
}

async function init() {
  console.log("Executing script.js");
  publishLog("Build Started....");
  const outDirPath = path.join(__dirname, "output");

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", (data) => {
    console.log(data.toString());
    publishLog(data.toString());
  });

  p.stdout.on("error", (data) => {
    console.log("Error ", data.toString());
    publishLog(`error:${data.toString()}`);
  });

  p.stdout.on("close", async (data) => {
    console.log("Build Completed");
    publishLog("Build Complete...");
    const distFolderPath = path.join(__dirname, "output", "dist");
    const distFolderContents = fs.readdirSync(distFolderPath, {
      recursive: true,
    });
    publishLog("Starting to upload");

    for (const file of distFolderContents) {
      const filePath = path.join(distFolderPath, file);
      if (fs.lstatSync(filePath).isDirectory()) continue;

      console.log("uploading", filePath);
      publishLog(`uploading ${filePath}`);

      const command = new PutObjectCommand({
        Bucket: "bharath-bucket-vercel01",
        Key: `__outputs/${project_id}/${file}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });

      await s3Client.send(command);

      console.log("uploaded", filePath);
      publishLog("uploaded");
    }

    console.log("Done copying files");
    publishLog("Done copying files");
    publisher.disconnect();
  });
}

init();
