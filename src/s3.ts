import type { ApiConfig } from "./config";

export const uploadVideoToS3 = async (
	cfg: ApiConfig,
	key: string,
	processesFilePath: string,
	contentType: string
) => {
	const s3File = cfg.s3Client.file(key, {
		bucket: cfg.s3Bucket,
	});

	const videoFile = Bun.file(processesFilePath);
	await s3File.write(videoFile, { type: contentType });
};
