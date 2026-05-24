import { useState, useRef, useCallback } from "react";

/**
 * useLocalMedia Hook
 * Manages local media device interactions (camera, microphone, screen sharing)
 * Handles: getUserMedia, getDisplayMedia, enumerateDevices, device switching
 */
export const useLocalMedia = () => {
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [previewAudioOn, setPreviewAudioOn] = useState(true);
  const [previewVideoOn, setPreviewVideoOn] = useState(true);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [availableMics, setAvailableMics] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicId, setSelectedMicId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const localVideoRef = useRef();
  const localStreamRef = useRef();
  const screenStreamRef = useRef();
  const settingsInitializedRef = useRef(false);

  /**
   * Initialize local media stream (camera/microphone)
   * @param {boolean} forPreview - Whether this is for preview (before joining)
   * @returns {Promise<MediaStream>}
   */
  const initializeMedia = useCallback(
    async (forPreview = true) => {
      try {
        const videoConstraints = selectedCameraId
          ? {
              deviceId: { exact: selectedCameraId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            };

        const audioConstraints = selectedMicId
          ? {
              deviceId: { exact: selectedMicId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });

        // Apply preview preferences
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];
        if (audioTrack) audioTrack.enabled = previewAudioOn;
        if (videoTrack) videoTrack.enabled = previewVideoOn;

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          try {
            localVideoRef.current.muted = true;
            localVideoRef.current.playsInline = true;
            const p =
              localVideoRef.current.play && localVideoRef.current.play();
            if (p && p.catch) p.catch(() => {});
          } catch (e) {
            // ignore autoplay errors
          }

          localVideoRef.current.onloadedmetadata = () => {
            try {
              localVideoRef.current.play().catch(() => {});
            } catch (e) {}
          };
        }

        setLoading(false);
        return stream;
      } catch (error) {
        console.error("Error accessing media devices:", error);
        setError(
          "Unable to access camera or microphone. Please check permissions."
        );
        setLoading(false);
        throw error;
      }
    },
    [previewAudioOn, previewVideoOn, selectedCameraId, selectedMicId]
  );

  /**
   * Enumerate available cameras and microphones
   */
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");
      const mics = devices.filter((d) => d.kind === "audioinput");
      setAvailableCameras(cameras);
      setAvailableMics(mics);
      if (!selectedCameraId && cameras[0])
        setSelectedCameraId(cameras[0].deviceId);
      if (!selectedMicId && mics[0]) setSelectedMicId(mics[0].deviceId);
    } catch (e) {
      console.warn("Could not enumerate devices", e);
    }
  }, [selectedCameraId, selectedMicId]);

  /**
   * Toggle audio on/off
   */
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    }
  }, []);

  /**
   * Toggle video on/off
   */
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  }, []);

  /**
   * Toggle preview audio (before joining)
   */
  const togglePreviewAudio = () => {
    setPreviewAudioOn((v) => {
      const next = !v;
      const audioTrack = localStreamRef.current?.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = next;
      return next;
    });
  };

  /**
   * Toggle preview video (before joining)
   */
  const togglePreviewVideo = () => {
    setPreviewVideoOn((v) => {
      const next = !v;
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = next;
      return next;
    });
  };

  /**
   * Start screen sharing
   */
  const shareScreen = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setIsScreenSharing(true);
      screenStreamRef.current = screenStream;

      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrack.onended = () => stopScreenShare();

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      return screenTrack;
    } catch (error) {
      console.error("Error sharing screen:", error);
      setIsScreenSharing(false);
      throw error;
    }
  }, []);

  /**
   * Stop screen sharing
   */
  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, []);

  /**
   * Handle device change (camera/microphone switching)
   */
  const handleDeviceChange = async () => {
    console.log("Applying new devices...");
    try {
      const videoConstraints = selectedCameraId
        ? {
            deviceId: { exact: selectedCameraId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          };

      const audioConstraints = selectedMicId
        ? {
            deviceId: { exact: selectedMicId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          };

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      });

      const newAudioTrack = newStream.getAudioTracks()[0];
      const newVideoTrack = newStream.getVideoTracks()[0];

      // Stop old stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Apply new stream
      localStreamRef.current = newStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }

      // Respect current mute state
      if (newAudioTrack) newAudioTrack.enabled = isAudioOn;
      if (newVideoTrack) newVideoTrack.enabled = isVideoOn;

      console.log("Devices updated successfully");
    } catch (err) {
      console.error("Failed to apply new devices:", err);
      setError("Failed to switch devices. Please check permissions.");
    }
  };

  /**
   * Clean up all media resources
   */
  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, []);

  return {
    // State
    isAudioOn,
    isVideoOn,
    isScreenSharing,
    previewAudioOn,
    previewVideoOn,
    availableCameras,
    availableMics,
    selectedCameraId,
    selectedMicId,
    error,
    loading,

    // Refs
    localVideoRef,
    localStreamRef,
    screenStreamRef,
    settingsInitializedRef,

    // Methods
    initializeMedia,
    enumerateDevices,
    toggleAudio,
    toggleVideo,
    togglePreviewAudio,
    togglePreviewVideo,
    shareScreen,
    stopScreenShare,
    handleDeviceChange,
    cleanup,

    // Setters
    setIsAudioOn,
    setIsVideoOn,
    setSelectedCameraId,
    setSelectedMicId,
    setError,
    setLoading,
  };
};
