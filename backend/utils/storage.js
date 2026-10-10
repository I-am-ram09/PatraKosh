// Cloud file storage (any S3-compatible service). Files are never kept on this server.
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

let client = null;
function getClient() {
  if (client) return client;
  const endpoint = process.env.S3_ENDPOINT || undefined;
  client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint,
    forcePathStyle: endpoint ? true : false, // Supabase / R2 / B2 style
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

const bucket = () => process.env.S3_BUCKET;

async function putFile(key, buffer, contentType) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    })
  );
}

// Returns { body (Readable stream), contentLength } or null if the object doesn't exist.
async function getFile(key) {
  try {
    const out = await getClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return { body: out.Body, contentLength: out.ContentLength };
  } catch (err) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function deleteFile(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

module.exports = { putFile, getFile, deleteFile };
