import { v2 as cloudinary } from "cloudinary";
import { config } from "../config";
import { prisma } from "./prisma";

/**
 * Guarda una imagen y devuelve su URL pública.
 * - Con CLOUDINARY_URL: sube a Cloudinary (optimiza para celulares).
 * - Sin ella (desarrollo/pruebas): guarda en PostgreSQL y la sirve /api/images/:id.
 */
export async function saveImage(data: Buffer, mimeType: string): Promise<string> {
  if (config.CLOUDINARY_URL) {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "achoflores", transformation: [{ width: 1200, crop: "limit", quality: "auto", fetch_format: "auto" }] }, (err, res) =>
          err || !res ? reject(err) : resolve(res),
        )
        .end(data);
    });
    return result.secure_url;
  }
  const blob = await prisma.imageBlob.create({ data: { mimeType, data: new Uint8Array(data) } });
  return `/api/images/${blob.id}`;
}
