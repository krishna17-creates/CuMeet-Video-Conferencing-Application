import { useState, useRef, useCallback } from "react";
import { Device } from "mediasoup-client";

/**
 * useSFUConnection Hook
 * Manages SFU (Selective Forwarding Unit) connection using mediasoup-client
 * Handles: Device creation, Transport management, Producer/Consumer lifecycle
 */
export const useSFUConnection = (socketEmitters) => {
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState("");
  const [pendingProducers, setPendingProducers] = useState([]);

  // Refs for SFU connection
  const sfuDeviceRef = useRef();
  const sfuSendTransportRef = useRef();
  const sfuRecvTransportRef = useRef();
  const sfuProducersRef = useRef(new Map());
  const sfuConsumersRef = useRef(new Map());
  const producerToConsumerRef = useRef(new Map());
  const sfuRecvTransportReadyRef = useRef(false);

  /**
   * Initialize SFU connection
   * Sets up Device, Send Transport, and Recv Transport
   */
  const initializeSfuConnection = useCallback(
    async (localStreamRef) => {
      console.log("Initializing SFU connection...");
      setParticipants([]);

      try {
        // 1. Get Router RTP capabilities from server
        const routerRtpCapabilities =
          await socketEmitters.emitGetRouterRtpCapabilities();

        if (routerRtpCapabilities && routerRtpCapabilities.error) {
          throw new Error(
            `Could not get router capabilities: ${routerRtpCapabilities.error}`
          );
        }

        // 2. Create a mediasoup-client Device
        const device = new Device();
        sfuDeviceRef.current = device;

        // 3. Load capabilities into the device
        await device.load({ routerRtpCapabilities });
        console.log("SFU Device loaded");

        // 4. Create a "send" transport to send our media
        const sendTransportParams =
          await socketEmitters.emitCreateWebRtcTransport("send");

        if (sendTransportParams.error) {
          throw new Error(
            `Error creating send transport: ${sendTransportParams.error}`
          );
        }

        const sendTransport = device.createSendTransport(sendTransportParams);
        sfuSendTransportRef.current = sendTransport;

        sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
          socketEmitters
            .emitConnectTransport(sendTransport.id, dtlsParameters)
            .then(() => callback())
            .catch(errback);
        });

        sendTransport.on(
          "produce",
          async ({ kind, rtpParameters, appData }, callback, errback) => {
            try {
              const producerId = await socketEmitters.emitProduce(
                sendTransport.id,
                kind,
                rtpParameters,
                appData
              );
              callback({ id: producerId });
            } catch (err) {
              errback(err);
            }
          }
        );

        // 5. Create producers for our local video and audio tracks
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            const audioProducer = await sendTransport.produce({ track: audioTrack });
            sfuProducersRef.current.set("audio", audioProducer);
            console.log("Audio producer created:", audioProducer.id);
          }

          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            const videoProducer = await sendTransport.produce({ track: videoTrack });
            sfuProducersRef.current.set("video", videoProducer);
            console.log("Video producer created:", videoProducer.id);
          }
        }

        // 6. Create a "receive" transport to receive media from others
        const recvTransportParams =
          await socketEmitters.emitCreateWebRtcTransport("recv");

        if (recvTransportParams.error) {
          throw new Error(
            `Error creating recv transport: ${recvTransportParams.error}`
          );
        }

        const recvTransport = device.createRecvTransport(recvTransportParams);
        sfuRecvTransportRef.current = recvTransport;

        recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
          socketEmitters
            .emitConnectTransport(recvTransport.id, dtlsParameters)
            .then(() => callback())
            .catch(errback);
        });

        sfuRecvTransportReadyRef.current = true;
        console.log("Recv transport created. Checking for buffered producers.");

        // Consume buffered producers
        setPendingProducers((prevPendingProducers) => {
          if (prevPendingProducers.length > 0) {
            console.log(
              `Consuming ${prevPendingProducers.length} buffered producers.`
            );
            prevPendingProducers.forEach((producerInfo) =>
              consumeSfuStream(producerInfo)
            );
            return [];
          }
          return [];
        });
      } catch (err) {
        console.error("SFU initialization error:", err);
        setError(err.message);
        throw err;
      }
    },
    [socketEmitters]
  );

  /**
   * Consume a remote producer's stream
   */
  const consumeSfuStream = useCallback(
    async ({ producerId, userId, userName, kind }) => {
      console.log(
        `%c[SFU] Attempting to consume producer: ${producerId} (kind: ${kind}, user: ${userName})`,
        "color: #0088cc"
      );

      if (!sfuDeviceRef.current || !sfuRecvTransportRef.current) {
        console.error(
          "[SFU] Consume failed: SFU device or receive transport is not ready."
        );
        return;
      }

      try {
        const { rtpCapabilities } = sfuDeviceRef.current;
        const transportId = sfuRecvTransportRef.current.id;

        console.log(
          `[SFU] Emitting 'consume' to server for producer ${producerId} on transport ${transportId}`
        );

        const params = await socketEmitters.emitConsume(
          rtpCapabilities,
          producerId,
          transportId
        );

        if (params.error) {
          throw new Error(`Server consume error: ${params.error}`);
        }

        console.log(`[SFU] Calling sfuRecvTransport.consume() for ${producerId}`);
        const consumer = await sfuRecvTransportRef.current.consume(params);
        console.log(
          `[SFU] Consume successful. Created consumer ${consumer.id} for producer ${producerId}`
        );

        sfuConsumersRef.current.set(consumer.id, consumer);
        producerToConsumerRef.current.set(producerId, consumer.id);

        // Resume the consumer on the server
        console.log(`[SFU] Emitting 'resume-consumer' for ${consumer.id}`);
        socketEmitters.emitResumeConsumer(consumer.id);

        const { track } = consumer;
        console.log(
          `[SFU] Got track ${track.kind} (${track.id}) for consumer ${consumer.id}`
        );

        // Update React state
        console.log(`[SFU] Updating participants state for userId: ${userId}`);
        setParticipants((prev) => {
          const existingParticipant = prev.find((p) => p.userId === userId);

          if (existingParticipant) {
            console.log(
              `[SFU] State: Adding track to existing participant ${userName}`
            );

            const oldStream = existingParticipant.stream;
            const allTracks = [...oldStream.getTracks(), track];
            const newStream = new MediaStream(allTracks);

            return prev.map((p) =>
              p.userId === userId
                ? {
                    ...p,
                    stream: newStream,
                    audioOn: kind === "audio" ? true : p.audioOn,
                    videoOn: kind === "video" ? true : p.videoOn,
                  }
                : p
            );
          } else {
            console.log(
              `[SFU] State: Creating new participant ${userName} with first track`
            );
            return [
              ...prev,
              {
                socketId: `sfu-${userId}`,
                userId,
                userName,
                stream: new MediaStream([track]),
                audioOn: kind === "audio",
                videoOn: kind === "video",
              },
            ];
          }
        });

        console.log(`[SFU] Participant state update complete for ${userId}`);
      } catch (error) {
        console.error(
          `[SFU] CRITICAL FAILURE in consume callback for producer ${producerId}:`,
          error
        );
        setError(error.message);
      }
    },
    [socketEmitters]
  );

  /**
   * Handle existing producers when transport is ready
   */
  const handleExistingProducers = useCallback((producers) => {
    console.log("Received existing producers:", producers);
    if (sfuRecvTransportReadyRef.current) {
      console.log("Recv transport ready, consuming immediately.");
      producers.forEach((producerInfo) => consumeSfuStream(producerInfo));
    } else {
      console.log("Recv transport NOT ready, buffering producers.");
      setPendingProducers(producers);
    }
  }, [consumeSfuStream]);

  /**
   * Replace producer track (for device switching, screen share, etc.)
   */
  const replaceProducerTrack = useCallback(
    async (kind, newTrack) => {
      try {
        const producer = sfuProducersRef.current.get(kind);
        if (producer && newTrack) {
          console.log(`[SFU] Replacing ${kind} track...`);
          await producer.replaceTrack({ track: newTrack });
          console.log(`[SFU] ${kind} track replaced successfully`);
          return true;
        }
        return false;
      } catch (error) {
        console.error(`[SFU] Error replacing ${kind} track:`, error);
        setError(error.message);
        return false;
      }
    },
    []
  );

  /**
   * Toggle producer (pause/resume)
   */
  const toggleProducer = useCallback((kind, enabled) => {
    try {
      const producer = sfuProducersRef.current.get(kind);
      if (producer) {
        if (enabled) {
          producer.resume();
        } else {
          producer.pause();
        }
        console.log(`[SFU] ${kind} producer ${enabled ? "resumed" : "paused"}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[SFU] Error toggling ${kind} producer:`, error);
      return false;
    }
  }, []);

  const removeParticipant = useCallback((userId) => {
    setParticipants((prev) => {
      const participant = prev.find((p) => p.userId === userId);
      if (participant?.stream) {
        participant.stream.getTracks().forEach((track) => track.stop());
      }
      return prev.filter((p) => p.userId !== userId);
    });
  }, []);

  const closeConsumerByProducerId = useCallback((producerId) => {
    const consumerId = producerToConsumerRef.current.get(producerId);
    if (!consumerId) return;

    const consumer = sfuConsumersRef.current.get(consumerId);
    if (consumer) {
      consumer.close();
      sfuConsumersRef.current.delete(consumerId);
    }
    producerToConsumerRef.current.delete(producerId);

    setParticipants((prev) =>
      prev
        .map((participant) => {
          const remainingTracks = participant.stream
            ?.getTracks()
            .filter((track) => track.id !== consumer?.track?.id);

          if (!remainingTracks || remainingTracks.length === participant.stream?.getTracks().length) {
            return participant;
          }

          return {
            ...participant,
            stream: new MediaStream(remainingTracks),
            audioOn: remainingTracks.some((track) => track.kind === "audio"),
            videoOn: remainingTracks.some((track) => track.kind === "video"),
          };
        })
        .filter((participant) => participant.stream?.getTracks().length > 0)
    );
  }, []);

  /**
   * Destroy SFU connection and clean up resources
   */
  const destroySfuConnection = useCallback(() => {
    console.log("Tearing down SFU connection.");

    if (sfuSendTransportRef.current) {
      sfuSendTransportRef.current.close();
      sfuSendTransportRef.current = null;
    }

    if (sfuRecvTransportRef.current) {
      sfuRecvTransportRef.current.close();
      sfuRecvTransportRef.current = null;
    }

    if (sfuDeviceRef.current) {
      sfuDeviceRef.current = null;
    }

    if (sfuProducersRef.current.size > 0) {
      sfuProducersRef.current.forEach((producer) => producer.close());
      sfuProducersRef.current.clear();
    }

    if (sfuConsumersRef.current.size > 0) {
      sfuConsumersRef.current.forEach((consumer) => consumer.close());
      sfuConsumersRef.current.clear();
    }

    producerToConsumerRef.current.clear();
    sfuRecvTransportReadyRef.current = false;
    setParticipants([]);
  }, []);

  return {
    // State
    participants,
    error,
    pendingProducers,

    // Refs
    sfuDeviceRef,
    sfuSendTransportRef,
    sfuRecvTransportRef,
    sfuProducersRef,
    sfuConsumersRef,
    sfuRecvTransportReadyRef,

    // Methods
    initializeSfuConnection,
    consumeSfuStream,
    handleExistingProducers,
    replaceProducerTrack,
    toggleProducer,
    removeParticipant,
    closeConsumerByProducerId,
    destroySfuConnection,

    // Setters
    setParticipants,
    setError,
    setPendingProducers,
  };
};
