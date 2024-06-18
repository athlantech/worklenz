import path from "path";
import {isProduction, isTestServer, log_error} from "./utils";
import mime from "mime";

import {BlobServiceClient, StorageSharedKeyCredential} from '@azure/storage-blob';

const {AZURE_ACCOUNT_NAME, AZURE_ACCOUNT_KEY, AZURE_CONTAINER_NAME} = process.env;

if (!AZURE_ACCOUNT_NAME || !AZURE_ACCOUNT_KEY) {
  log_error("Invalid Azure Credentials submitted. Please check .env file.");
}

const azure_account_name = AZURE_ACCOUNT_NAME || 'sample-azure-account';
const azure_account_key = AZURE_ACCOUNT_KEY || 'sample-azure-account-key';
const azure_container_name = AZURE_CONTAINER_NAME || 'sample-azure-container-name';

const storageAccountBaseUrl = `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net`
const sharedKeyCredential = new StorageSharedKeyCredential(azure_account_name, azure_account_key);

const blobServiceClient = new BlobServiceClient(
    storageAccountBaseUrl,
    sharedKeyCredential
);

export function getRootDir() {
  if (isTestServer()) return "test-server";
  if (isProduction()) return "secure";
  return "local-server";
}

export function getKey(teamId: string, projectId: string, attachmentId: string, type: string) {
  return path.join(getRootDir(), teamId, projectId, `${attachmentId}.${type}`).replace(/\\/g, "/");
}

export function getAvatarKey(userId: string, type: string) {
  return path.join("avatars", getRootDir(), `${userId}.${type}`).replace(/\\/g, "/");
}

export async function uploadBuffer(buffer: Buffer, type: string, location: string): Promise<string | null> {
  try {
    const containerClient = blobServiceClient.getContainerClient(azure_container_name);
    // Create blob client from container client
    const blockBlobClient = await containerClient.getBlockBlobClient(location);

    // Upload buffer
    await blockBlobClient.uploadData(buffer);
    return `${storageAccountBaseUrl}/${AZURE_CONTAINER_NAME}/${location}`

  } catch (error) {
    log_error(error);
  }

  return null;
}

export async function uploadBase64(base64Data: string, location: string) {
  try {
    const buffer = Buffer.from(base64Data.replace(/^data:(.*?);base64,/, ""), "base64");
    const type = base64Data.split(";")[0].split(":")[1] || null;

    if (!type) return null;

    await uploadBuffer(buffer, type, location);
    return `${storageAccountBaseUrl}/${AZURE_CONTAINER_NAME}/${location}`;
  } catch (error) {
    log_error(error);
  }

  return null;
}

export async function deleteObject(location: string) {
    const containerClient = blobServiceClient.getContainerClient(azure_container_name);

    // Create blob client from container client
    const blockBlobClient = await containerClient.getBlockBlobClient(location);

    // include: Delete the base blob and all of its snapshots.
    // only: Delete only the blob's snapshots and not the blob itself.
    const options = {
        deleteSnapshots: 'include' // or 'only'
    };
    const blobDeleteResponse = await blockBlobClient.delete(
        options
    );

    if (!blobDeleteResponse.errorCode) {
        console.log(`deleted blob ${azure_container_name}`);
    }
}

// Calculates the size of a blob
async function getBlobSize(accountName: string, accountKey: string, containerName: string, blobName: string): Promise<number> {
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    const properties = await blobClient.getProperties();
    return properties.contentLength || -1;
}