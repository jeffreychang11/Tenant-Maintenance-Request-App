// Trims a video to 15s and recompresses it entirely in the browser using
// native MediaRecorder + canvas capture (no added dependencies — e.g. no
// ffmpeg.wasm, which would mean a ~25-30MB one-time download on mobile
// data just to compress a clip). Re-encoding happens by redrawing the
// source video onto a downscaled canvas in real time and recording that,
// so a 15s clip takes roughly 15s wall-clock to process — a deliberate
// trade for staying dependency-free and working the same way everywhere.
// Falls back to the original file untouched if MediaRecorder/canvas
// capture isn't supported or fails, so a tenant's upload is never blocked.

const MAX_DURATION_SECONDS = 15;
const TARGET_BYTES = 5 * 1024 * 1024;
const MAX_WIDTH = 640;
const TARGET_VIDEO_BITS_PER_SECOND = Math.floor((TARGET_BYTES * 8) / MAX_DURATION_SECONDS);

const CANDIDATE_MIME_TYPES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return CANDIDATE_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export async function compressVideo(file: File): Promise<File> {
  const mimeType = pickMimeType();
  if (!mimeType || typeof HTMLVideoElement === "undefined") return file;

  try {
    return await new Promise<File>((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      const cleanupAndFallback = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };

      video.onerror = cleanupAndFallback;

      video.onloadedmetadata = () => {
        if (!video.videoWidth || !video.videoHeight) {
          cleanupAndFallback();
          return;
        }

        const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanupAndFallback();
          return;
        }

        const withCaptureStream = video as HTMLVideoElement & {
          captureStream?: () => MediaStream;
        };
        const canvasStream = canvas.captureStream(30);
        const audioTracks = withCaptureStream.captureStream?.().getAudioTracks() ?? [];
        const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(combined, {
            mimeType,
            videoBitsPerSecond: TARGET_VIDEO_BITS_PER_SECOND,
          });
        } catch {
          cleanupAndFallback();
          return;
        }

        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        let drawing = true;
        function drawFrame() {
          if (!drawing) return;
          ctx!.drawImage(video, 0, 0, width, height);
          requestAnimationFrame(drawFrame);
        }

        const stopAt = Math.min(video.duration || MAX_DURATION_SECONDS, MAX_DURATION_SECONDS);
        const timer = setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, stopAt * 1000);

        recorder.onstop = () => {
          drawing = false;
          clearTimeout(timer);
          URL.revokeObjectURL(url);

          if (chunks.length === 0) {
            resolve(file);
            return;
          }

          const outType = mimeType.startsWith("video/mp4") ? "video/mp4" : "video/webm";
          const ext = outType === "video/mp4" ? "mp4" : "webm";
          const name = file.name.replace(/\.[^.]+$/, "") + `.${ext}`;
          const blob = new Blob(chunks, { type: outType });
          resolve(new File([blob], name, { type: outType, lastModified: Date.now() }));
        };

        video.onended = () => {
          if (recorder.state !== "inactive") recorder.stop();
        };

        recorder.start();
        drawFrame();
        video.play().catch(() => {
          if (recorder.state !== "inactive") recorder.stop();
          else cleanupAndFallback();
        });
      };
    });
  } catch {
    return file;
  }
}
