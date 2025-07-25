import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, UserForbiddenError } from "./errors";
import path from "path";
import { randomBytes } from "crypto";

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
	const { videoId } = req.params as { videoId?: string };
	if (!videoId) {
		throw new BadRequestError("Invalid video ID");
	}

	const token = getBearerToken(req.headers);
	const userID = validateJWT(token, cfg.jwtSecret);

	console.log("uploading thumbnail for video", videoId, "by user", userID);
	const formData = await req.formData();
	const img = formData.get("thumbnail");
	if (img instanceof File == false) {
		throw new BadRequestError("Image is not an instace of a file");
	}
	
	const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

	if (img.size > MAX_UPLOAD_SIZE) {
		throw new BadRequestError("File size exceeds 10MB limit");
	}

	const mediaType = img.type;
	const fileType = mediaType.split("/")[1];
	if (mediaType !== "image/jpeg" && mediaType !== "image/png") {
		throw new BadRequestError("Not a valid format")
	}
	const thumbnailId = randomBytes(32).toString("base64")
	const imageData = await img.arrayBuffer();
	await Bun.write(path.join(cfg.assetsRoot, `/${thumbnailId}.${fileType}`), imageData)

	const videoMetadata = getVideo(cfg.db, videoId);
	if (videoMetadata?.userID !== userID) {
		throw new UserForbiddenError("Unauthorized to make this change");
	}

	updateVideo(cfg.db, {
		...videoMetadata,
		thumbnailURL: `http://localhost:8091/assets/${thumbnailId}.${fileType}`,
	});

	const updatedVideo = getVideo(cfg.db, videoId);

	return respondWithJSON(200, updatedVideo);
}
