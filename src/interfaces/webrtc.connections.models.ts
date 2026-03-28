export interface WebRTCOfferPayload {
  from: string;
  to: string;
  offer: any;
}

export interface WebRTCAnswerPayload {
  from: string;
  to: string;
  answer: any;
}

export interface WebRTCIceCandidatePayload {
  from: string;
  to: string;
  candidate: any;
}

export interface WebRTCUsersConnectedPayload {
  initiator: string;
  receiver: string;
}

export interface WebRTCFileTransferCompletePayload {
  senderEmail: string;
  receiverEmail: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  timeElapsed: number;
  transferType: string;
}
