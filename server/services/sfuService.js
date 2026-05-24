/**
 * SFU (Selective Forwarding Unit) Service
 * Handles Mediasoup transport, producer, and consumer operations
 */

/**
 * Create a WebRTC transport
 */
const createWebRtcTransport = async (router, listenIp, announcedIp) => {
  try {
    const transport = await router.createWebRtcTransport({
      listenIps: [
        {
          ip: listenIp || '0.0.0.0',
          announcedIp: announcedIp || null,
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maxSctpMessageSize: 262144,
    });

    console.log(`[SFUService] WebRTC transport created: ${transport.id}`);

    return {
      transport,
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    };
  } catch (error) {
    console.error('[SFUService] Error creating transport:', error.message);
    throw error;
  }
};

/**
 * Connect transport (DTLS handshake)
 */
const connectTransport = async (transport, dtlsParameters) => {
  try {
    await transport.connect({ dtlsParameters });
    console.log(`[SFUService] Transport ${transport.id} connected`);
    return true;
  } catch (error) {
    console.error('[SFUService] Error connecting transport:', error.message);
    throw error;
  }
};

/**
 * Produce a media track
 */
const produceTrack = async (transport, kind, rtpParameters, appData) => {
  try {
    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData,
    });

    console.log(
      `[SFUService] Producer created: ${producer.id} (kind: ${kind})`
    );

    return producer;
  } catch (error) {
    console.error('[SFUService] Error producing track:', error.message);
    throw error;
  }
};

/**
 * Check if can consume a producer
 */
const canConsume = (router, producerId, rtpCapabilities) => {
  return router.canConsume({ producerId, rtpCapabilities });
};

/**
 * Consume a remote producer
 */
const consumeProducer = async (transport, producerId, rtpCapabilities) => {
  try {
    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    console.log(
      `[SFUService] Consumer created: ${consumer.id} (kind: ${consumer.kind})`
    );

    return consumer;
  } catch (error) {
    console.error('[SFUService] Error consuming producer:', error.message);
    throw error;
  }
};

/**
 * Resume consumer
 */
const resumeConsumer = async (consumer) => {
  try {
    await consumer.resume();
    console.log(`[SFUService] Consumer ${consumer.id} resumed`);
    return true;
  } catch (error) {
    console.error('[SFUService] Error resuming consumer:', error.message);
    throw error;
  }
};

/**
 * Pause consumer
 */
const pauseConsumer = async (consumer) => {
  try {
    await consumer.pause();
    console.log(`[SFUService] Consumer ${consumer.id} paused`);
    return true;
  } catch (error) {
    console.error('[SFUService] Error pausing consumer:', error.message);
    throw error;
  }
};

/**
 * Close producer
 */
const closeProducer = (producer) => {
  try {
    producer.close();
    console.log(`[SFUService] Producer ${producer.id} closed`);
    return true;
  } catch (error) {
    console.error('[SFUService] Error closing producer:', error.message);
    return false;
  }
};

/**
 * Close consumer
 */
const closeConsumer = (consumer) => {
  try {
    consumer.close();
    console.log(`[SFUService] Consumer ${consumer.id} closed`);
    return true;
  } catch (error) {
    console.error('[SFUService] Error closing consumer:', error.message);
    return false;
  }
};

/**
 * Close transport
 */
const closeTransport = (transport) => {
  try {
    transport.close();
    console.log(`[SFUService] Transport ${transport.id} closed`);
    return true;
  } catch (error) {
    console.error('[SFUService] Error closing transport:', error.message);
    return false;
  }
};

module.exports = {
  createWebRtcTransport,
  connectTransport,
  produceTrack,
  canConsume,
  consumeProducer,
  resumeConsumer,
  pauseConsumer,
  closeProducer,
  closeConsumer,
  closeTransport,
};
