import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const CleanupUpload = ({ onSubmit, loading }) => {
  const [cameraOpen, setCameraOpen] = useState(false);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [cameraError, setCameraError] = useState('');

  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    setCameraOpen(false);
  }, []);

  // Attach camera stream to video
  useEffect(() => {
    if (
      cameraOpen &&
      videoRef.current &&
      streamRef.current
    ) {
      videoRef.current.srcObject = streamRef.current;

      videoRef.current.play().catch((err) => {
        console.error('Video play error:', err);
      });
    }
  }, [cameraOpen]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  // Cleanup preview object URL
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // Capture GPS location
  const captureLocation = () => {
    setLocation(null);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError(
        'Geolocation is not supported by this device.'
      );
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setLocationLoading(false);
      },

      (error) => {
        console.error('GPS error:', error);

        setLocation(null);
        setLocationLoading(false);

        setLocationError(
          'Could not capture GPS. Please enable location permission and try again.'
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Open live camera
  const startCamera = async () => {
    setCameraError('');

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError(
        'Live camera is not supported in this browser.'
      );
      return;
    }

    try {
      stopCamera();

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: 'environment',
            },
          },
          audio: false,
        });

      streamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      console.error('Camera error:', error);

      setCameraError(
        'Camera access is required. Please allow camera permission and try again.'
      );
    }
  };

  // Capture photo from live video
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      setCameraError(
        'Camera is not ready yet. Please wait a moment and try again.'
      );
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError(
            'Could not capture photo. Please try again.'
          );
          return;
        }

        const capturedFile = new File(
          [blob],
          `cleanup-${Date.now()}.jpg`,
          {
            type: 'image/jpeg',
          }
        );

        setFile(capturedFile);

        setPreview((oldPreview) => {
          if (oldPreview) {
            URL.revokeObjectURL(oldPreview);
          }

          return URL.createObjectURL(blob);
        });

        stopCamera();

        // GPS is captured AFTER the live photo
        captureLocation();
      },
      'image/jpeg',
      0.9
    );
  };

  // Retake photo
  const handleRetake = async () => {
    setFile(null);
    setLocation(null);
    setLocationError('');
    setCameraError('');

    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }

    await startCamera();
  };

  // Submit cleanup evidence
  const handleSubmit = () => {
    if (!file || !location) {
      return;
    }

    onSubmit({
      file,
      latitude: location.latitude,
      longitude: location.longitude,
    });
  };

  return (
    <div className="flex flex-col gap-4">

      {/* INITIAL LIVE CAMERA BUTTON */}
      {!cameraOpen && !preview && (
        <button
          type="button"
          onClick={startCamera}
          className="
            w-full
            flex flex-col
            items-center
            justify-center
            border-2
            border-dashed
            border-gray-300
            rounded-xl
            p-8
            hover:border-red-400
            hover:bg-red-50
            transition-colors
          "
        >
          <span className="text-5xl mb-3">
            📷
          </span>

          <p className="font-semibold text-gray-700">
            Open Live Camera
          </p>

          <p className="text-sm text-gray-500 mt-1">
            Capture an after-cleanup photo
          </p>
        </button>
      )}

      {/* LIVE CAMERA */}
      {cameraOpen && (
        <div className="space-y-3">

          <div className="rounded-xl overflow-hidden border-2 border-red-300 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-80 object-cover"
            />
          </div>

          <button
            type="button"
            onClick={capturePhoto}
            className="
              w-full
              py-3.5
              rounded-xl
              bg-red-600
              hover:bg-red-700
              text-white
              font-semibold
              shadow-md
            "
          >
             Capture After Photo
          </button>

          <button
            type="button"
            onClick={stopCamera}
            className="
              w-full
              py-2.5
              rounded-xl
              border
              border-gray-300
              text-gray-600
              text-sm
            "
          >
            Cancel Camera
          </button>
        </div>
      )}

      {/* PHOTO PREVIEW */}
      {preview && !cameraOpen && (
        <div className="space-y-3">

          <div className="rounded-xl overflow-hidden border-2 border-green-300">

            <img
              src={preview}
              alt="After-cleanup evidence"
              className="w-full max-h-72 object-cover"
            />

            <div className="bg-green-50 px-3 py-2 border-t border-green-200">
              <p className="text-sm text-green-700 font-medium">
                 Live after-cleanup photo captured
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRetake}
            disabled={loading}
            className="
              w-full
              py-2.5
              rounded-xl
              border
              border-gray-300
              text-gray-700
              text-sm
              font-medium
              hover:bg-gray-50
            "
          >
             Retake Photo
          </button>
        </div>
      )}

      {/* CAMERA ERROR */}
      {cameraError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
           {cameraError}
        </div>
      )}

      {/* GPS STATUS */}
      <div className="text-sm px-1">

        {locationLoading && (
          <span className="text-blue-600">
            📡 Capturing current GPS location…
          </span>
        )}

        {!locationLoading && location && (
          <span className="text-green-600">
             Location captured (
            {location.latitude.toFixed(5)},{' '}
            {location.longitude.toFixed(5)})
          </span>
        )}

        {!locationLoading &&
          !location &&
          !locationError &&
          file && (
            <span className="text-gray-500">
               Waiting for GPS location…
            </span>
          )}

        {!locationLoading &&
          !location &&
          !file &&
          !locationError && (
            <span className="text-gray-400">
               GPS will be captured immediately after
              taking the photo
            </span>
          )}

        {locationError && (
          <div className="flex flex-col gap-2">

            <span className="text-amber-600">
               {locationError}
            </span>

            <button
              type="button"
              onClick={captureLocation}
              className="text-blue-600 text-xs underline self-start"
            >
              Retry GPS
            </button>

          </div>
        )}
      </div>

      {/* HIDDEN CANVAS USED TO CREATE IMAGE */}
      <canvas
        ref={canvasRef}
        className="hidden"
      />

      {/* SUBMIT */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={
          !file ||
          !location ||
          locationLoading ||
          loading
        }
        className={`
          w-full
          py-3.5
          rounded-xl
          font-semibold
          text-white
          text-sm
          transition-all
          ${
            !file ||
            !location ||
            locationLoading ||
            loading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 active:scale-95 shadow-md'
          }
        `}
      >
        {loading
          ? 'Submitting…'
          : ' Submit Cleanup Evidence'}
      </button>

    </div>
  );
};

export default CleanupUpload;