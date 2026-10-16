import { EVENT_REJECT_CODES } from "@workspace/shared";

export class RejectError extends Error {

    public readonly success = false;

    constructor(public readonly code: EVENT_REJECT_CODES, message: string) {
        super(message);

        this.name = "OMSRejectError";
    }
}