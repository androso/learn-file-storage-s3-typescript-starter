import { respondWithJSON } from "./json";
import { rm } from "fs/promises";
import path from "path";
import { type ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { uploadVideoToS3 } from "../s3";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
	const { videoId } = req.params as { videoId: string };
	if (!videoId) {
		throw new BadRequestError("Invalid video id format");
	}

	const token = getBearerToken(req.headers);
	const userId = validateJWT(token, cfg.jwtSecret);

	const UPLOAD_LIMIT = 1 << 30;
	const videoMetadata = getVideo(cfg.db, videoId);

	if (videoMetadata?.userID !== userId) {
		throw new UserForbiddenError("User is not the owner of this video");
	}

	const formData = await req.formData();

	const uploadedVideo = formData.get("video") as File;
	if (uploadedVideo.size > UPLOAD_LIMIT) {
		throw new BadRequestError("File exceeds size limit");
	}

	if (uploadedVideo.type !== "video/mp4") {
		throw new BadRequestError("Only mp4 videos allowed");
	}

	const tmpFilePath = path.join("/tmp", `${videoId}.mp4`);
	await Bun.write(tmpFilePath, uploadedVideo);

	let key = `${videoId}.mp4`;
	await uploadVideoToS3(cfg, key, tmpFilePath, "video/mp4");
	const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`;
	videoMetadata.videoURL = videoURL;
	updateVideo(cfg.db, videoMetadata);

	await Promise.all([rm(tmpFilePath, { force: true })]);

	return respondWithJSON(200, videoMetadata);
}
