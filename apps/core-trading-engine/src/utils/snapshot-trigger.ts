import { Engine } from "../engine/core-engine";

export async function triggerSnapshot(engine: Engine) {

    const interval = process.env.SNAPSHOT_INTERVAL ? Number(process.env.SNAPSHOT_INTERVAL) : 86400 //one day

    setInterval(async () => {
        try {
            await engine.snapshotEngine.uploadSnapshot(engine.eventSequenceId);
            console.log("A new snapshot is created and stored in the cloud");
        } catch (error) {
            console.error("Failed to create the engine snaphot : ", error);
        }
    }, interval * 1000);
}