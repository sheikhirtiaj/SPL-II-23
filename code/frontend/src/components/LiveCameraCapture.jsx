import React, { useCallback, useEffect, useRef, useState } from "react";

const MAX_PHOTO_SIZE = 8 * 1024 * 1024;

function getLocationError(error) {
  if (error?.code === 1) return "Location permission was denied. Enable location permission, then retake the photo.";
  if (error?.code === 2) return "Your current location could not be determined. Move to an area with GPS reception and retake the photo.";
  if (error?.code === 3) return "GPS lookup timed out. Please retake the photo and location.";
  return error?.message || "Could not capture the photo and GPS location together.";
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support GPS location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new Error(getLocationError(error))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export default function LiveCameraCapture({ onCapture, disabled = false }) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preview, setPreview] = useState("");
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const startCamera = async () => {
    setError("");
    setLocation(null);
    onCapture(null);
    setPreview("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Live camera access requires a supported browser and a secure connection (HTTPS or localhost).");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (cameraError) {
      console.error("Camera access failed:", cameraError);
      setError("Camera permission is required. Allow camera access and try again.");
    }
  };

  const capturePhotoAndLocation = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setError("The camera is not ready. Wait until the live preview appears, then try again.");
      return;
    }

    setCapturing(true);
    setError("");
    const photoPromise = new Promise((resolve, reject) => {
      const maxWidth = 1600;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not prepare the captured photo. Please try again."));
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Could not capture the photo. Please try again.")),
        "image/jpeg",
        0.85
      );
    });

    try {
      // The live image snapshot and GPS lookup start together on this capture action.
      const [blob, position] = await Promise.all([photoPromise, getCurrentPosition()]);
      if (blob.size > MAX_PHOTO_SIZE) throw new Error("The captured photo is larger than 8 MB. Please retake it.");
      const file = new File([blob], `live-evidence-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      const capturedLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setLocation(capturedLocation);
      setPreview(URL.createObjectURL(blob));
      onCapture({ file, ...capturedLocation, capturedAt: new Date().toISOString() });
      stopCamera();
    } catch (captureError) {
      console.error("Photo/GPS capture failed:", captureError);
      setError(captureError.message || "Could not capture photo and GPS together. Please try again.");
      onCapture(null);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {!cameraOpen && !preview && (
        <button type="button" onClick={startCamera} disabled={disabled}
          className="w-full rounded-xl border-2 border-dashed border-gray-300 p-6 text-center hover:border-red-400 hover:bg-red-50 disabled:opacity-60">
          <span className="block text-4xl mb-2" aria-hidden="true">📷</span>
          <span className="block font-semibold text-gray-800">Open live camera</span>
          <span className="block text-sm text-gray-500 mt-1">Gallery uploads are not available</span>
        </button>
      )}

      {cameraOpen && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border-2 border-red-300 bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-80 object-cover" />
          </div>
          <p className="text-sm text-gray-600">Press capture once. The photo and current GPS location will be requested together.</p>
          <button type="button" onClick={capturePhotoAndLocation} disabled={capturing || disabled}
            className="w-full rounded-lg bg-red-600 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {capturing ? "Capturing photo + GPS…" : "Capture photo + GPS"}
          </button>
          <button type="button" onClick={() => { stopCamera(); onCapture(null); }} disabled={capturing}
            className="w-full rounded-lg border border-gray-300 py-2 text-gray-700 disabled:opacity-60">
            Cancel camera
          </button>
        </div>
      )}

      {preview && !cameraOpen && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-green-200">
            <img src={preview} alt="Live camera evidence preview" className="w-full max-h-72 object-contain bg-gray-50" />
          </div>
          <p className="text-sm text-green-700">Live photo and GPS captured: {location?.latitude.toFixed(6)}, {location?.longitude.toFixed(6)}</p>
          <button type="button" onClick={startCamera} disabled={disabled}
            className="w-full rounded-lg border border-gray-300 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            Retake photo + GPS together
          </button>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
